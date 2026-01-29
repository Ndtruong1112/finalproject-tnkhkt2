# IoT Smart Home Monitoring System

Hệ thống giám sát và điều khiển nhà thông minh (Smart Home) tự phát triển (Full-stack IoT). Dự án bao gồm thiết kế phần cứng (ESP32), xây dựng Backend (Node.js/MQTT) và giao diện Frontend (Dashboard) cho phép giám sát thời gian thực và tự động hóa.

![Dashboard Preview](docs/dashboard.png)

## Tổng quan dự án

Hệ thống cho phép người dùng:
1. **Giám sát thời gian thực:** Nhiệt độ, độ ẩm, chất lượng không khí, khí gas.
2. **Điều khiển từ xa:** Bật/tắt thiết bị (Quạt, đèn, bơm) qua Internet.
3. **Biểu đồ thông minh:** Xem lịch sử dữ liệu với khả năng Zoom/Pan, tự động nhận diện cảm biến mới.
4. **Tự động hóa (Automation):** Thiết lập luật điều khiển If-Then (Ví dụ: Nhiệt độ > 30°C -> Bật Quạt).
5. **Cấu hình dễ dàng:** ESP32 tự phát WiFi Portal để cài đặt mạng (không cần hard-code).

## Công nghệ sử dụng

### Phần cứng (Hardware)
* **MCU:** ESP32 (WROOM-32)
* **Cảm biến:** DHT11 (Nhiệt/Ẩm), MQ135 (Gas/Không khí)
* **Hiển thị:** OLED SSD1306 (0.96 inch)
* **Actuators:** Relay Module
* **Giao thức:** WiFi (Station & AP Mode)

### Phần mềm (Software)
* **Backend:** Node.js, Express.js
* **Giao thức:** MQTT (Mosquitto), WebSocket (Socket.io)
* **Frontend:** HTML5, CSS3, JavaScript (Vanilla), Chart.js (Zoom Plugin)
* **Công cụ:** OpenVPN/Ngrok (Remote Access)

---

## Cài đặt và Hướng dẫn

### 1. Kết nối Phần cứng (Wiring)
| Thiết bị | Chân ESP32 | Ghi chú |
| :--- | :--- | :--- |
| **Relay** | GPIO 18 | Điều khiển tải |
| **DHT11** | GPIO 5 | Data |
| **MQ135** | GPIO 34 | Analog Output |
| **OLED SDA** | GPIO 21 | I2C Data |
| **OLED SCL** | GPIO 22 | I2C Clock |

### 2. Cài đặt Server
Yêu cầu: Đã cài đặt [Node.js](https://nodejs.org/).

```bash
# 1. Di chuyển vào thư mục server
cd server

# 2. Cài đặt các thư viện cần thiết
npm install

# 3. Khởi chạy server
node server.js
```
Sau khi chạy, truy cập Dashboard tại: `http://localhost:3000`

### 3. Nạp Firmware (ESP32)
* Mở thư mục `firmware` bằng **Arduino IDE**.
* Cài đặt thư viện (Sketch -> Include Library -> Manage Libraries):
  * `WiFiManager` (tzapu)
  * `PubSubClient` (Nick O'Leary)
  * `ArduinoJson` (Benoit Blanchon)
  * `Adafruit SSD1306` & `Adafruit GFX`
  * `DHT sensor library`
* Chọn đúng board **DOIT ESP32 DEVKIT V1** và nạp code.

### 4. Chạy giả lập (Simulation Tool)
Hỗ trợ kiểm thử hệ thống với 8 thiết bị ảo (Vườn lan, Hồ cá, Phòng server...) mà không cần phần cứng thật.

```bash
# Tại thư mục server, chạy lệnh:
node virtual_device.js
```

---

## Tính năng chi tiết

* **Dashboard Grid Layout:** Giao diện dạng lưới hiện đại, hỗ trợ kéo thả (Drag & Drop) để sắp xếp vị trí Widget.
* **Auto Discovery:** Server tự động phát hiện và hiển thị thiết bị mới khi chúng kết nối vào MQTT.
* **Smart Charts:** Tự động tạo và lưu trữ biểu đồ cho mọi thông số dạng số (Number) được gửi lên.
* **Config Portal:** Khi mới khởi động hoặc mất WiFi, ESP32 sẽ phát WiFi tên `SETUP_IOT`. Kết nối vào đó để cấu hình WiFi nhà và MQTT Server.

## Tác giả
**[Tên của bạn]** - *Full Stack IoT Developer*
