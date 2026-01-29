const mqtt = require('mqtt');

// Kết nối đến Broker (Mosquitto)
const client = mqtt.connect('mqtt://localhost:1883');

// Cấu hình 8 thiết bị giả lập với các thông số khác nhau
const devices = [
    { 
        id: 'Phong_Khach', 
        name: 'Phòng Khách',
        params: { temp: 28.5, humi: 60, co2: 400 }, 
        hasRelay: true, relayState: "OFF"
    },
    { 
        id: 'Nha_Bep', 
        name: 'Nhà Bếp',
        params: { gas: 120, temp: 32, smoke: 15 }, 
        hasRelay: true, relayState: "ON" // Quạt hút
    },
    { 
        id: 'Vuon_Lan', 
        name: 'Vườn Lan Tự Động',
        params: { soil_moisture: 75, light_lux: 4500, temp: 26 }, 
        hasRelay: true, relayState: "OFF" // Máy bơm
    },
    { 
        id: 'Ho_Ca_Koi', 
        name: 'Hồ Cá Koi',
        params: { water_temp: 24.5, ph_level: 7.2, oxygen: 8.5 }, 
        hasRelay: false 
    },
    { 
        id: 'Phong_Server', 
        name: 'Phòng Server IT',
        params: { cpu_temp: 45, fan_speed: 1200, ups_battery: 98 }, 
        hasRelay: true, relayState: "ON" // Điều hòa
    },
    { 
        id: 'Dong_Ho_Dien', 
        name: 'Đồng Hồ Tổng',
        params: { voltage: 220.5, current: 5.2, power_watt: 1140 }, 
        hasRelay: false 
    },
    { 
        id: 'Gara_O_To', 
        name: 'Gara Ô Tô',
        params: { co_level: 12, temp: 29 }, 
        hasRelay: true, relayState: "OFF" // Cửa cuốn
    },
    { 
        id: 'Phong_Ngu_Master', 
        name: 'Phòng Ngủ Master',
        params: { temp: 22, humi: 55, sound_db: 30 }, 
        hasRelay: true, relayState: "ON" // Đèn ngủ
    }
];

client.on('connect', () => {
    console.log(">>> Đã khởi động 8 thiết bị ảo. Đang gửi dữ liệu...");

    setInterval(() => {
        devices.forEach(dev => {
            // 1. Tạo biến động nhẹ cho dữ liệu (để biểu đồ nhìn cho thật)
            for (let key in dev.params) {
                // Random tăng giảm một chút (-0.5 đến +0.5)
                const noise = (Math.random() - 0.5) * (dev.params[key] * 0.05); 
                let newVal = dev.params[key] + noise;
                
                // Làm tròn 2 số thập phân
                dev.params[key] = parseFloat(newVal.toFixed(2));
            }

            // 2. Gói dữ liệu JSON
            const payload = {
                id: dev.id,
                name: dev.name, // Gửi kèm tên để Web hiển thị đẹp luôn
                ...dev.params
            };

            // Nếu thiết bị có Relay (Quạt/Đèn)
            if (dev.hasRelay) {
                // Thỉnh thoảng (tỉ lệ 5%) tự bật/tắt relay để test giao diện
                // if (Math.random() < 0.05) {
                //    dev.relayState = dev.relayState === "ON" ? "OFF" : "ON";
                // }
                payload.relay = dev.relayState;
                payload.auto = true; // Giả vờ đang bật auto
            }

            // 3. Gửi lên MQTT
            client.publish('esp32/data', JSON.stringify(payload));
        });
        
        console.log(">>> Đã cập nhật dữ liệu cho 8 thiết bị!");

    }, 2000); // Cập nhật mỗi 2 giây cho biểu đồ chạy nhanh
});