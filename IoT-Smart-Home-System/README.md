# IoT Smart Home Ultimate - Full Stack Monitoring System

> **Hệ thống giám sát và điều khiển nhà thông minh toàn diện, xây dựng trên nền tảng ESP32, Node.js và MQTT.**

![Project Dashboard](docs/dashboard.png)

## 1. Giới thiệu (Overview)

Dự án này là một giải pháp **Full-stack IoT** (Internet of Things) được thiết kế để giải quyết bài toán giám sát môi trường và điều khiển thiết bị từ xa với độ trễ thấp (Real-time).

Khác với các dự án Arduino đơn lẻ, hệ thống này mô phỏng một kiến trúc IoT công nghiệp thu nhỏ với đầy đủ các tầng:
* **Edge Device (Thiết bị biên):** ESP32 xử lý tín hiệu cảm biến và điều khiển relay.
* **Connectivity (Kết nối):** MQTT Broker đóng vai trò trung chuyển tin nhắn tốc độ cao.
* **Backend Server:** Node.js xử lý logic nghiệp vụ, lưu trữ và tự động hóa.
* **Frontend Dashboard:** Giao diện web tương tác thời gian thực, hỗ trợ đa nền tảng.

---

## 2. Kiến trúc hệ thống & Luồng dữ liệu

Hệ thống hoạt động dựa trên mô hình **Publish/Subscribe** (Xuất bản/Đăng ký) để tối ưu hóa băng thông và đảm bảo tính thời gian thực.

### Sơ đồ luồng dữ liệu (Data Flow):

1.  **Thu thập:** ESP32 đọc dữ liệu từ cảm biến (Nhiệt độ, Độ ẩm, Gas) chu kỳ 2s/lần.
2.  **Đóng gói:** Dữ liệu được đóng gói thành JSON: `{"id": "LivingRoom", "temp": 28.5, "relay": "OFF"}`.
3.  **Truyền tải:** ESP32 gửi (Publish) gói tin lên topic `esp32/data` thông qua MQTT Broker.
4.  **Xử lý trung tâm:**
    * Server Node.js (Subscriber) nhận gói tin từ Broker.
    * Lưu dữ liệu vào bộ nhớ đệm (RAM) để phục vụ vẽ biểu đồ.
    * **Automation Engine:** So sánh dữ liệu với các luật (Rules) đã cài đặt. Nếu thỏa mãn (ví dụ: Nhiệt > 35), Server tự động gửi lệnh điều khiển ngược lại thiết bị.
5.  **Hiển thị:** Server đẩy dữ liệu xuống trình duyệt người dùng qua **WebSocket (Socket.io)**, giúp giao diện cập nhật ngay lập tức mà không cần F5.

---

## 3. Phân tích công nghệ & Thư viện

### A. Phía Vi điều khiển (Firmware - ESP32)

| Thư viện | Vai trò & Tại sao sử dụng? |
| :--- | :--- |
| **WiFiManager** | **Cấu hình mạng động (Dynamic Captive Portal).**<br>Thay vì nạp cứng (hard-code) SSID/Pass trong code, thư viện này cho phép ESP32 tự phát WiFi khi mất kết nối. Người dùng dùng điện thoại kết nối vào để nhập WiFi nhà và địa chỉ MQTT Server. |
| **PubSubClient** | **Giao thức MQTT.**<br>Thư viện nhẹ và ổn định nhất để ESP32 giao tiếp với MQTT Broker. Hỗ trợ cơ chế "Last Will" (thông báo khi thiết bị mất điện đột ngột) và "Keep Alive". |
| **ArduinoJson** | **Xử lý dữ liệu JSON.**<br>Giúp tuần tự hóa (Serialize) dữ liệu cảm biến thành chuỗi JSON chuẩn để gửi đi và giải mã (Deserialize) lệnh điều khiển từ Server gửi về. |
| **Adafruit SSD1306** | **Giao diện tại chỗ.**<br>Hiển thị IP, trạng thái kết nối và thông số môi trường ngay trên màn hình OLED gắn trên thiết bị. |

### B. Phía Máy chủ (Backend - Node.js)

| Thư viện | Vai trò & Tại sao sử dụng? |
| :--- | :--- |
| **Express.js** | **Web Server Framework.**<br>Tạo HTTP Server để phục vụ giao diện Web và cung cấp các RESTful API (như API đổi tên thiết bị, API thêm luật tự động). |
| **MQTT.js** | **MQTT Client cho Node.js.**<br>Giúp Server kết nối vào Broker. Nó đóng vai trò như một "bộ não", lắng nghe mọi dữ liệu từ các cảm biến gửi về. |
| **Socket.io** | **Giao tiếp thời gian thực (Real-time).**<br>Tạo kênh liên lạc 2 chiều giữa Server và Trình duyệt Web. Khi MQTT nhận dữ liệu mới, Socket.io đẩy ngay xuống Web Dashboard, giúp biểu đồ nhảy số tức thì. |
| **fs-extra** | **Lưu trữ cục bộ (Persistence).**<br>Lưu cấu hình hệ thống (Luật tự động, Tên thiết bị, Cấu hình biểu đồ) vào file JSON, đảm bảo không mất dữ liệu khi khởi động lại Server. |

### C. Phía Giao diện (Frontend)

| Thư viện | Vai trò & Tại sao sử dụng? |
| :--- | :--- |
| **Chart.js + Zoom** | **Trực quan hóa dữ liệu.**<br>Vẽ biểu đồ đường (Line Chart) mượt mà. Plugin Zoom cho phép người dùng lăn chuột để phóng to/thu nhỏ trục thời gian, xem lại lịch sử chi tiết. |
| **SortableJS** | **Trải nghiệm người dùng (UX).**<br>Cho phép người dùng kéo thả các Widget và Biểu đồ để sắp xếp lại giao diện theo ý thích cá nhân. |

---

## 4. Hướng dẫn Cài đặt & Triển khai

### Yêu cầu tiên quyết
* **Phần cứng:** ESP32 DevKit V1, DHT11, MQ135, Relay, OLED 0.96".
* **Phần mềm:** Node.js (v14+), Mosquitto Broker, Arduino IDE.

### Bước 1: Kết nối phần cứng (Wiring)

| Thiết bị | Chân ESP32 | Chức năng |
| :--- | :--- | :--- |
| **DHT11** | GPIO 5 | Đo nhiệt độ, độ ẩm |
| **Relay** | GPIO 18 | Điều khiển thiết bị (Quạt/Đèn) |
| **MQ135** | GPIO 34 | Đo chất lượng không khí (Analog) |
| **OLED SDA** | GPIO 21 | Giao tiếp I2C (Dữ liệu) |
| **OLED SCL** | GPIO 22 | Giao tiếp I2C (Đồng hồ) |

### Bước 2: Triển khai Server
Server đóng vai trò trung tâm điều phối.

```bash
# 1. Di chuyển vào thư mục server
cd server

# 2. Cài đặt các thư viện phụ thuộc (được liệt kê trong package.json)
npm install

# 3. Khởi chạy hệ thống
node server.js
```
* Truy cập Dashboard: `http://localhost:3000`
* Tài khoản mặc định: `admin` / `123`

### Bước 3: Nạp Firmware
Sử dụng Arduino IDE để nạp code cho ESP32.
* **Lưu ý:** Lần đầu khởi động, ESP32 sẽ phát WiFi tên **`SETUP_IOT_SYSTEM`**.
* Kết nối điện thoại vào WiFi đó -> Trình duyệt tự mở trang cấu hình -> Nhập WiFi nhà bạn và IP của máy tính chạy Server.

### Bước 4: Kiểm thử giả lập (Simulation Tool)
Hệ thống tích hợp sẵn công cụ giả lập để test giao diện khi chưa có phần cứng. Tool này sẽ tạo ra 8 thiết bị ảo (Hồ cá, Phòng server, Vườn lan...) gửi dữ liệu ngẫu nhiên.

```bash
# Tại thư mục server, chạy lệnh:
node virtual_device.js
```

---

## 5. Tính năng nâng cao

1.  **Auto Discovery (Tự động phát hiện):** Bạn không cần khai báo thiết bị trước. Chỉ cần nạp code và bật nguồn ESP32, Server sẽ tự động nhận diện ID thiết bị và hiển thị lên Dashboard.
2.  **Smart Charting:** Hệ thống tự động phân tích dữ liệu gửi lên. Nếu bạn gửi thêm thông số mới (ví dụ: `pH`, `voltage`), Dashboard sẽ tự động tạo biểu đồ mới tương ứng.
3.  **Automation Rule Engine:**
    * Cho phép tạo luật logic: `IF` (Điều kiện) `THEN` (Hành động).
    * Ví dụ: *Nếu Khí Gas > 300 thì Bật Quạt thông gió.*
    * Logic này chạy trên Server, đảm bảo hoạt động ngay cả khi người dùng không mở Web.

## 6. Đóng góp & Bản quyền
Dự án được phát triển bởi **[Tên của bạn]**.
Mã nguồn mở theo giấy phép MIT.
