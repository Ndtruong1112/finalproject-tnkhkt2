const express = require('express');
const http = require('http');
const mqtt = require('mqtt');
const socketIo = require('socket.io');
const fs = require('fs-extra');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// File lưu trữ
const DATA_FILE = './devices.json';
const RULES_FILE = './rules.json'; 
const CHARTS_FILE = './charts_config.json';
const USER_FILE = './users.json'; // File chứa user/pass

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'iot_v4_secret', resave: true, saveUninitialized: true }));

// --- BỘ NHỚ ---
let devices = {};
let rules = []; 
let chartConfig = {}; 
let history = {}; 

// Load dữ liệu cũ từ file
if (fs.existsSync(DATA_FILE)) try { devices = fs.readJsonSync(DATA_FILE); } catch(e) {}
if (fs.existsSync(RULES_FILE)) try { rules = fs.readJsonSync(RULES_FILE); } catch(e) {}
if (fs.existsSync(CHARTS_FILE)) try { chartConfig = fs.readJsonSync(CHARTS_FILE); } catch(e) {}

// --- MQTT ---
const client = mqtt.connect('mqtt://localhost:1883', { reconnectPeriod: 5000 });

client.on('connect', () => { 
    console.log(">>> MQTT Connected");
    client.subscribe('esp32/data');
});

client.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        const id = data.id;
        if (!id) return;

        // 1. Tạo mới thiết bị nếu chưa có
        if (!devices[id]) devices[id] = { name: id, status: "online", order: 99 };
        
        const currentName = devices[id].name || id;
        
        // 2. Cập nhật dữ liệu + Đánh dấu ONLINE + Lưu thời gian LastSeen
        devices[id] = { 
            ...devices[id], 
            ...data, 
            name: currentName, 
            status: "online", 
            lastSeen: Date.now() // Quan trọng: Cập nhật thời điểm mới nhất thấy thiết bị
        };

        // 3. Lưu lịch sử biểu đồ
        const timestamp = new Date().toLocaleTimeString();
        const IGNORED_KEYS = ['id', 'name', 'status', 'order', 'relay', 'auto', 'threshold', 'lastSeen'];

        for (const [key, value] of Object.entries(data)) {
            if (!IGNORED_KEYS.includes(key) && typeof value === 'number') {
                const uniqueKey = `${id}:${key}`;
                if (!history[uniqueKey]) history[uniqueKey] = [];
                history[uniqueKey].push({ t: timestamp, v: value });
                if (history[uniqueKey].length > 50) history[uniqueKey].shift();

                // Auto config chart
                if (!chartConfig[uniqueKey]) {
                    chartConfig[uniqueKey] = { alias: `${devices[id].name} - ${key}`, visible: true, size: 'half', order: 99 };
                    fs.writeJson(CHARTS_FILE, chartConfig); 
                }
            }
        }

        // 4. Kiểm tra Tự động hóa
        checkAutomation(id, devices[id]);

        // 5. Gửi cập nhật xuống Web
        io.emit('update_ui', devices);
        io.emit('update_chart_data', { history, chartConfig });

    } catch (e) { console.log(e); }
});

// --- TÍNH NĂNG MỚI: QUÉT THIẾT BỊ OFFLINE ---
const OFFLINE_TIMEOUT = 15000; // 15 giây không gửi tin -> Coi là Offline

setInterval(() => {
    const now = Date.now();
    let hasChange = false;

    for (const id in devices) {
        const dev = devices[id];
        // Nếu thiết bị đang Online mà quá hạn lastSeen -> Chuyển sang Offline
        if (dev.status === 'online' && dev.lastSeen && (now - dev.lastSeen > OFFLINE_TIMEOUT)) {
            console.log(`>>> Thiết bị [${id}] đã mất kết nối (Offline)`);
            devices[id].status = 'offline';
            hasChange = true;
        }
    }

    // Chỉ gửi update xuống Web khi có sự thay đổi trạng thái
    if (hasChange) {
        io.emit('update_ui', devices);
    }
}, 5000); // Chạy quét mỗi 5 giây

// --- LOGIC AUTOMATION ---
function checkAutomation(triggerId, data) {
    rules.forEach(rule => {
        if (rule.triggerDevice !== triggerId) return;
        if (data[rule.triggerParam] === undefined) return;
        let val = data[rule.triggerParam];
        let met = false;
        if (rule.condition === '>' && val > rule.value) met = true;
        if (rule.condition === '<' && val < rule.value) met = true;
        
        if (met) {
            const cmd = {};
            const parts = rule.action.split(':'); 
            cmd[parts[0]] = parts[1];
            client.publish(`esp32/control/${rule.targetDevice}`, JSON.stringify(cmd));
            if(devices[rule.targetDevice]) {
                devices[rule.targetDevice] = { ...devices[rule.targetDevice], ...cmd };
                io.emit('update_ui', devices);
            }
        }
    });
}

// --- API & ROUTES ---
app.post('/api/chart-config', (req, res) => {
    const newConfig = req.body; 
    for(const key in newConfig) {
        if(!chartConfig[key]) chartConfig[key] = {};
        chartConfig[key] = { ...chartConfig[key], ...newConfig[key] };
    }
    fs.writeJson(CHARTS_FILE, chartConfig);
    io.emit('update_chart_config', chartConfig);
    res.json({ success: true });
});

app.post('/api/rename', (req, res) => {
    const { id, newName } = req.body;
    if (devices[id]) {
        devices[id].name = newName;
        fs.writeJson(DATA_FILE, devices); // Lưu lại tên mới vào file
        io.emit('update_ui', devices);
        res.json({ success: true });
    } else res.json({ success: false });
});

app.post('/api/reorder', (req, res) => {
    const orderList = req.body;
    orderList.forEach((id, index) => { if(devices[id]) devices[id].order = index; });
    fs.writeJson(DATA_FILE, devices);
    res.json({ success: true });
});

app.get('/api/rules', (req, res) => res.json(rules));
app.post('/api/rules', (req, res) => {
    rules.push({ ...req.body, id: Date.now() });
    fs.writeJson(RULES_FILE, rules);
    res.json({ success: true });
});
app.delete('/api/rules/:id', (req, res) => {
    rules = rules.filter(r => r.id != req.params.id);
    fs.writeJson(RULES_FILE, rules);
    res.json({ success: true });
});

// Đổi mật khẩu
app.post('/change-password', (req, res) => {
    const { oldPass, newPass, newUser } = req.body;
    let user = { username: "admin", password: "123" };
    try { user = fs.readJsonSync(USER_FILE); } catch(e) {}

    if (oldPass === user.password) {
        user.username = newUser;
        user.password = newPass;
        fs.writeJsonSync(USER_FILE, user);
        req.session.loggedin = false; // Bắt đăng nhập lại
        res.json({ success: true, msg: "Đổi mật khẩu thành công! Vui lòng đăng nhập lại." });
    } else {
        res.json({ success: false, msg: "Mật khẩu cũ không đúng!" });
    }
});

// Login & Auth
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.post('/login', (req, res) => {
    let user = { username: "admin", password: "123" };
    try { user = fs.readJsonSync(USER_FILE); } catch(e) {}
    
    if (req.body.username === user.username && req.body.password === user.password) {
        req.session.loggedin = true;
        res.redirect('/');
    } else res.send('Sai tài khoản hoặc mật khẩu!');
});
app.get('/logout', (req, res) => { req.session.loggedin = false; res.redirect('/login'); });

function checkAuth(req, res, next) { if (req.session.loggedin) next(); else res.redirect('/login'); }
app.get('/', checkAuth, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- SOCKET IO ---
io.on('connection', (socket) => {
    const sortedDevices = Object.fromEntries(Object.entries(devices).sort(([,a],[,b]) => (a.order || 0) - (b.order || 0)));
    socket.emit('update_ui', sortedDevices);
    socket.emit('init_chart', { history, chartConfig });

    socket.on('change_settings', (data) => {
        if (devices[data.id]) {
            devices[data.id] = { ...devices[data.id], ...data.settings };
            client.publish(`esp32/control/${data.id}`, JSON.stringify(data.settings));
            io.emit('update_ui', devices);
        }
    });
});

server.listen(3000, () => console.log(">>> SERVER V4.4 RUNNING: http://localhost:3000"));
