#include <WiFi.h>
#include <WiFiManager.h> 
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// --- CẤU HÌNH CHÂN ---
#define MQ135_PIN 34  
#define RELAY_PIN 18  

// --- BIẾN TOÀN CỤC ---
char mqtt_server[100] = "0.tcp.ap.ngrok.io";
char mqtt_port[6] = "1883";
const char* deviceID = "ESP32_MQ135_01"; 

int airValue = 0;
int threshold = 300;     
bool isAuto = true;      
String relayStatus = "OFF";
bool shouldSaveConfig = false;

WiFiClient espClient;
PubSubClient client(espClient);
Preferences preferences; 

// --- KHAI BÁO WIFIMANAGER TOÀN CỤC (QUAN TRỌNG) ---
WiFiManager wm;
// Khai báo tham số toàn cục để không bị tạo lại nhiều lần gây lặp
WiFiManagerParameter custom_mqtt_server("server", "MQTT Server (Ngrok/LAN IP)", mqtt_server, 100);
WiFiManagerParameter custom_mqtt_port("port", "MQTT Port", mqtt_port, 6);

// --- CALLBACK LƯU CẤU HÌNH ---
void saveConfigCallback () {
  Serial.println(">> Phat hien luu cau hinh!");
  shouldSaveConfig = true;
}

// --- CALLBACK NHẬN LỆNH ---
void callback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<200> doc;
  deserializeJson(doc, payload, length);

  if (doc.containsKey("auto")) {
    isAuto = doc["auto"];
    preferences.putBool("isAuto", isAuto); 
  }
  if (doc.containsKey("threshold")) {
    threshold = doc["threshold"];
    preferences.putInt("threshold", threshold); 
  }
  if (doc.containsKey("relay") && !isAuto) {
    String status = doc["relay"].as<String>();
    digitalWrite(RELAY_PIN, (status == "ON") ? HIGH : LOW);
    relayStatus = status;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(MQ135_PIN, INPUT);

  // 1. ĐỌC CẤU HÌNH TỪ FLASH
  preferences.begin("iot_config", false); 
  isAuto = preferences.getBool("isAuto", true);      
  threshold = preferences.getInt("threshold", 300);
  
  // Đọc Server cũ ra biến toàn cục
  String saved_server = preferences.getString("server", mqtt_server); 
  String saved_port = preferences.getString("port", mqtt_port);
  saved_server.toCharArray(mqtt_server, 100);
  saved_port.toCharArray(mqtt_port, 6);

  // Cập nhật giá trị vào ô nhập liệu (để hiển thị đúng cái cũ)
  custom_mqtt_server.setValue(mqtt_server, 100);
  custom_mqtt_port.setValue(mqtt_port, 6);

  // 2. CẤU HÌNH WIFIMANAGER (CHỈ LÀM 1 LẦN Ở ĐÂY)
  // Xóa cài đặt cũ để test (bỏ comment nếu cần reset wifi)
  // wm.resetSettings(); 
  
  wm.setSaveConfigCallback(saveConfigCallback);
  wm.addParameter(&custom_mqtt_server);
  wm.addParameter(&custom_mqtt_port);
  
  // Đặt tiêu đề cho Web Config
  wm.setTitle("CAU HINH INTERNET IOT"); 
  
  // Tăng thời gian chờ kết nối (tránh timeout quá sớm)
  wm.setConnectTimeout(30); 

  // Tự động kết nối
  if (!wm.autoConnect("SETUP_MAY_LOC_KHI")) {
    Serial.println("Loi ket noi WiFi...");
    // Không restart ngay, để nó chạy xuống loop xử lý tiếp
  }

  // Nếu người dùng vừa nhập config mới
  if (shouldSaveConfig) {
    saveParamsToFlash();
  }

  // 3. THIẾT LẬP MQTT
  int port_int = atoi(mqtt_port);
  client.setServer(mqtt_server, port_int);
  client.setCallback(callback);
}

// Hàm phụ tách riêng để lưu dữ liệu gọn gàng
void saveParamsToFlash() {
  strcpy(mqtt_server, custom_mqtt_server.getValue());
  strcpy(mqtt_port, custom_mqtt_port.getValue());
  
  preferences.putString("server", mqtt_server);
  preferences.putString("port", mqtt_port);
  Serial.println("Da luu Server moi vao Flash!");
  
  shouldSaveConfig = false;
  
  // Cập nhật ngay cho Client
  int port_int = atoi(mqtt_port);
  client.setServer(mqtt_server, port_int);
}

void loop() {
  // --- 1. XỬ LÝ MẤT KẾT NỐI ---
  
  // Nếu mất WiFi -> Tự động để thư viện lo, hoặc reset nếu treo quá lâu
  if (WiFi.status() != WL_CONNECTED) {
     // Code này để trống, ESP32 mặc định sẽ tự reconnect background
  }

  // Nếu có WiFi nhưng Mất Server MQTT -> Bật lại Config Portal
  if (WiFi.status() == WL_CONNECTED && !client.connected()) {
    Serial.print("Dang ket noi MQTT...");
    if (client.connect(deviceID)) {
      Serial.println("OK!");
      char topic[50];
      sprintf(topic, "esp32/control/%s", deviceID);
      client.subscribe(topic);
    } else {
      Serial.print("Loi rc=");
      Serial.println(client.state());
      
      // >>> BẬT CHẾ ĐỘ SỬA LỖI <<<
      Serial.println("Mo lai WiFi Config de sua Link Server...");
      
      wm.setConfigPortalTimeout(120); // Cho 120s để sửa, nếu không sẽ thử lại
      
      // Khởi động lại Portal với tên cũ
      if (!wm.startConfigPortal("SUA_LOI_SERVER")) {
        Serial.println("Het gio config, thu ket noi lai server cu...");
      }

      // Nếu trong lúc mở Portal, người dùng có bấm Save
      if (shouldSaveConfig) {
        saveParamsToFlash();
      }
    }
  }

  client.loop();

  // --- 2. LOGIC ĐIỀU KHIỂN ---
  airValue = analogRead(MQ135_PIN);

  if (isAuto) {
    if (airValue > threshold) {
      digitalWrite(RELAY_PIN, HIGH);
      relayStatus = "ON";
    } else {
      digitalWrite(RELAY_PIN, LOW);
      relayStatus = "OFF";
    }
  }

  // --- 3. GỬI DỮ LIỆU ---
  static unsigned long lastTime = 0;
  if (millis() - lastTime > 2000) {
    lastTime = millis();
    if (client.connected()) {
      StaticJsonDocument<256> doc;
      doc["id"] = deviceID;
      doc["mq135"] = airValue;
      doc["relay"] = relayStatus;
      doc["auto"] = isAuto;
      doc["threshold"] = threshold; 
      char buffer[256];
      serializeJson(doc, buffer);
      client.publish("esp32/data", buffer);
    }
  }
}