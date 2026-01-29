#include <WiFi.h>
#include <WiFiManager.h> 
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>

// --- CẤU HÌNH PHẦN CỨNG ---
#define DHTPIN 5     // Đổi sang chân 5 cho an toàn
#define DHTTYPE DHT11
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// --- BIẾN TOÀN CỤC ---
char mqtt_server[100] = "192.168.1.x"; // Giá trị mặc định
char mqtt_port[6] = "1883";
const char* deviceID = "ESP32_TramThoiTiet"; 

WiFiClient espClient;
PubSubClient client(espClient);
Preferences preferences; 
DHT dht(DHTPIN, DHTTYPE);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
WiFiManager wm; 

// Khai báo tham số config toàn cục
WiFiManagerParameter custom_mqtt_server("server", "MQTT Server IP", mqtt_server, 100);
WiFiManagerParameter custom_mqtt_port("port", "MQTT Port", mqtt_port, 6);

bool shouldSaveConfig = false;

// --- HÀM HIỂN THỊ OLED ---
void showOLED(String line1, String line2, String line3) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  display.setCursor(0, 0);  display.println(line1); // Dòng trạng thái
  display.setCursor(0, 20); display.setTextSize(2); display.println(line2); // Nhiệt độ
  display.setCursor(0, 45); display.setTextSize(1); display.println(line3); // Độ ẩm
  
  display.display();
}

void saveConfigCallback () {
  Serial.println(">> Can luu cau hinh!");
  shouldSaveConfig = true;
}

void saveParamsToFlash() {
  strcpy(mqtt_server, custom_mqtt_server.getValue());
  strcpy(mqtt_port, custom_mqtt_port.getValue());
  preferences.putString("server", mqtt_server);
  preferences.putString("port", mqtt_port);
  
  int port_int = atoi(mqtt_port);
  client.setServer(mqtt_server, port_int);
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  
  // Khởi động OLED
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println(F("Lỗi OLED!")); for(;;);
  }
  showOLED("Khoi dong...", "IoT System", "Please wait");

  // 1. ĐỌC CẤU HÌNH TỪ FLASH
  preferences.begin("iot_weather", false); 
  String saved_server = preferences.getString("server", mqtt_server); 
  String saved_port = preferences.getString("port", mqtt_port);
  saved_server.toCharArray(mqtt_server, 100);
  saved_port.toCharArray(mqtt_port, 6);

  // Cập nhật giá trị cũ vào ô nhập liệu
  custom_mqtt_server.setValue(mqtt_server, 100);
  custom_mqtt_port.setValue(mqtt_port, 6);

  // 2. WIFI MANAGER
  wm.setSaveConfigCallback(saveConfigCallback);
  wm.addParameter(&custom_mqtt_server);
  wm.addParameter(&custom_mqtt_port);
  wm.setTitle("CAU HINH TRAM THOI TIET");
  wm.setConnectTimeout(30);

  // Tự động kết nối, nếu fail thì phát WiFi tên "SETUP_TRAM_THOI_TIET"
  if (!wm.autoConnect("SETUP_TRAM_THOI_TIET")) {
    showOLED("Loi WiFi", "Connect to:", "SETUP_TRAM...");
  } else {
    showOLED("WiFi OK", "Connecting", "Server...");
  }

  if (shouldSaveConfig) saveParamsToFlash();

  // 3. THIẾT LẬP MQTT
  int port_int = atoi(mqtt_port);
  client.setServer(mqtt_server, port_int);
}

void loop() {
  // --- 1. XỬ LÝ KẾT NỐI ---
  if (WiFi.status() == WL_CONNECTED && !client.connected()) {
    showOLED("Mat Server", "Reconnecting", mqtt_server);
    
    if (client.connect(deviceID)) {
      Serial.println("MQTT Connected");
    } else {
      Serial.print("Loi MQTT rc="); Serial.println(client.state());
      
      // Bật chế độ sửa lỗi nếu không kết nối được Server
      wm.setConfigPortalTimeout(120);
      if (!wm.startConfigPortal("SUA_LOI_SERVER")) {
         Serial.println("Timeout config...");
      }
      if (shouldSaveConfig) saveParamsToFlash();
    }
  }
  client.loop();

  // --- 2. ĐỌC CẢM BIẾN ---
  float h = dht.readHumidity();
  float t = dht.readTemperature();

  if (isnan(h) || isnan(t)) {
    Serial.println("Lỗi đọc DHT!");
    showOLED("Loi Sensor", "Kiem tra", "Day cam bien");
    return;
  }

  // --- 3. HIỂN THỊ LÊN MÀN HÌNH ---
  String status = client.connected() ? "Online" : "Offline";
  String tempStr = String(t, 1) + " C";
  String humiStr = "Do am: " + String(h, 0) + " %";
  
  // Chỉ hiển thị OLED, không cần delay
  showOLED(status + " | " + WiFi.localIP().toString(), tempStr, humiStr);

  // --- 4. GỬI DỮ LIỆU LÊN SERVER (3s/lần) ---
  static unsigned long lastTime = 0;
  if (millis() - lastTime > 3000) {
    lastTime = millis();
    if (client.connected()) {
      StaticJsonDocument<200> doc;
      doc["id"] = deviceID;
      doc["name"] = "Trạm Thời Tiết"; // Tên hiển thị đẹp trên web
      doc["temp"] = t;
      doc["humi"] = h;
      
      char buffer[256];
      serializeJson(doc, buffer);
      client.publish("esp32/data", buffer);
    }
  }
  // Delay nhẹ để tránh màn hình nháy quá nhanh
  delay(100); 
}
