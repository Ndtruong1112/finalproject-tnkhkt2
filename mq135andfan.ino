#define MQ135_PIN 4
#define RELAY_PIN 18

int airValue = 0;
int threshold = 300;   // ngưỡng bật quạt

void setup() {
  Serial.begin(115200);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);   // quạt OFF ban đầu

  Serial.println("MQ135 Air Quality System Started...");
}

void loop() {
  airValue = analogRead(MQ135_PIN);

  Serial.print("Air Quality Value: ");
  Serial.println(airValue);

  if (airValue > threshold) {
    digitalWrite(RELAY_PIN, HIGH);   // bật relay → bật quạt
    Serial.println(">> Air BAD - Fan ON");
  } else {
    digitalWrite(RELAY_PIN, LOW);    // tắt quạt
    Serial.println(">> Air GOOD - Fan OFF");
  }

  delay(2000);
}
