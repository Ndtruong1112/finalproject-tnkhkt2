# 🏠 IoT Smart Home Ultimate - Monitoring & Automation System

![Project Banner](docs/dashboard_screenshot.png)

## 📖 Giới thiệu (Overview)
**IoT Smart Home Ultimate** là hệ thống giám sát và điều khiển nhà thông minh toàn diện, được xây dựng từ con số 0 (Full-stack IoT). Hệ thống cho phép theo dõi thời gian thực các thông số môi trường (Nhiệt độ, Độ ẩm, Khí Gas...), điều khiển thiết bị từ xa qua Internet, vẽ biểu đồ lịch sử và thiết lập các luật tự động hóa (Automation Rules).

Dự án sử dụng giao thức **MQTT** để giao tiếp thời gian thực, với kiến trúc Microservices linh hoạt, dễ dàng mở rộng lên hàng trăm thiết bị.

## 🚀 Tính năng nổi bật (Key Features)

* **⚡ Real-time Dashboard (V4):** Giao diện dạng lưới (Grid Layout) hiện đại, hỗ trợ kéo thả (Drag & Drop) để sắp xếp Widget.
* **📈 Smart Charts:** Biểu đồ lịch sử dữ liệu với khả năng **Phóng to/Thu nhỏ (Zoom/Pan)**, tự động nhận diện cảm biến mới.
* **🤖 Automation Engine:** Tự tạo luật điều khiển thông minh ngay trên Web (Ví dụ: *Nếu Nhiệt độ > 30°C thì Bật Quạt*).
* **🌍 Remote Access:** Điều khiển thiết bị từ bất kỳ đâu thông qua **OpenVPN / Ngrok Tunnel**.
* **🛠️ Device Config Portal:** ESP32 tự phát WiFi để cấu hình mạng và MQTT Server (không cần nạp lại code).
* **💻 Virtual Simulation:** Tích hợp công cụ giả lập thiết bị để test hệ thống không cần phần cứng.

## 🛠️ Công nghệ sử dụng (Tech Stack)

### 🔌 Phần cứng (Hardware)
* **Vi điều khiển:** ESP32 (WROOM-32)
* **Cảm biến:** DHT11 (Nhiệt/Ẩm), MQ135 (Khí Gas/Chất lượng không khí)
* **Hiển thị:** Màn hình OLED SSD1306 0.96 inch
* **Actuators:** Relay Module (Điều khiển Quạt/Đèn)

### 💻 Phần mềm (Software)
* **Backend:** Node.js, Express
* **Protocol:** MQTT (Mosquitto/Aedes Broker), WebSocket (Socket.io)
* **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
* **Libraries:** * *Frontend:* Chart.js (với Plugin Zoom), SortableJS
    * *Embedded:* WiFiManager, PubSubClient, ArduinoJson

## ⚙️ Cài đặt & Hướng dẫn (Installation)

### 1. Cấu hình Phần cứng (Wiring)
| Thiết bị | Chân ESP32 |
| :--- | :--- |
| **Relay** | GPIO 18 |
| **DHT11** | GPIO 5 |
| **MQ135** | GPIO 34 (Analog) |
| **OLED SDA** | GPIO 21 |
| **OLED SCL** | GPIO 22 |

### 2. Cài đặt Server
Yêu cầu: Đã cài đặt [Node.js](https://nodejs.org/) và [Mosquitto](https://mosquitto.org/) (hoặc dùng Broker tích hợp).

```bash

# Cài đặt thư viện
npm install express socket.io mqtt fs-extra body-parser express-session

# Chạy Server
node server.js
