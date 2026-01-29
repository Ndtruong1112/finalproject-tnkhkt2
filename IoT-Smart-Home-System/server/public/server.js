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

const DATA_FILE = './devices.json';
const RULES_FILE = './rules.json'; 
const CHARTS_FILE = './charts_config.json'; // File lưu vị trí, size biểu đồ

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'iot_v4_secret', resave: true, saveUninitialized: true }));

let devices = {};
let rules = []; 
let chartConfig = {}; 
let history = {}; 

// Load dữ liệu
if (fs.existsSync(DATA_FILE)) try { devices = fs.readJsonSync(DATA_FILE); } catch(e) {}
if (fs.existsSync(RULES_FILE)) try { rules = fs.readJsonSync(RULES_FILE); } catch(e) {}
if (fs.existsSync(CHARTS_FILE)) try { chartConfig = fs.readJsonSync(CHARTS_FILE); } catch(e) {}

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

        if (!devices[id]) devices[id] = { name: id, status: "online", order: 99 };
        const currentName = devices[id].name || id;
        devices[id] = { ...devices[id], ...data, name: currentName, status: "online", lastSeen: Date.now() };

        // Lưu lịch sử biểu đồ
        const timestamp = new Date().toLocaleTimeString();
        const IGNORED_KEYS = ['id', 'name', 'status', 'order', 'relay', 'auto', 'threshold', 'lastSeen'];

        for (const [key, value] of Object.entries(data)) {
            if (!IGNORED_KEYS.includes(key) && typeof value === 'number') {
                const uniqueKey = `${id}:${key}`;
                if (!history[uniqueKey]) history[uniqueKey] = [];
                history[uniqueKey].push({ t: timestamp, v: value });
                if (history[uniqueKey].length > 50) history[uniqueKey].shift();

                // Tạo config mặc định nếu chưa có
                if (!chartConfig[uniqueKey]) {
                    chartConfig[uniqueKey] = { alias: `${devices[id].name} - ${key}`, visible: true, size: 'half', order: 99 };
                    fs.writeJson(CHARTS_FILE, chartConfig); 
                }
            }
        }

        checkAutomation(id, devices[id]);

        io.emit('update_ui', devices);
        io.emit('update_chart_data', { history, chartConfig });

    } catch (e) { console.log(e); }
});

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

// API
app.post('/api/chart-config', (req, res) => {
    // Merge config mới với config cũ (để giữ lại alias, order, size)
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
        fs.writeJson(DATA_FILE, devices);
        io.emit('update_ui', devices);
        res.json({ success: true });
    } else res.json({ success: false });
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

// Web Server
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.post('/login', (req, res) => {
    let user = { username: "admin", password: "123" };
    try { user = fs.readJsonSync('./users.json'); } catch(e) {}
    if (req.body.username === user.username && req.body.password === user.password) {
        req.session.loggedin = true;
        res.redirect('/');
    } else res.send('Sai pass!');
});
function checkAuth(req, res, next) { if (req.session.loggedin) next(); else res.redirect('/login'); }
app.get('/', checkAuth, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

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

server.listen(3000, () => console.log(">>> V4 SERVER: http://localhost:3000"));