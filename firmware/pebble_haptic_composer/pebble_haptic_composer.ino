/**
 * =============================================================================
 * Pebble Haptic Composer - Integrated Master Firmware
 * =============================================================================
 * Supported Hardware: Seeed Studio XIAO ESP32-S3
 * Breakout Modules: Dual Adafruit DRV2605L Haptic Controllers + 1x NeoPixel
 * =============================================================================
 */

#include <Wire.h>
#include <Adafruit_DRV2605.h>
#include <Adafruit_NeoPixel.h>
#include "driver/rtc_io.h"
#include <math.h>
#include <Preferences.h>  // Non-volatile flash storage for custom patterns
#include "presets_data.h" // Compiled default JSON sequence data from DAW

// --- PIN CONFIGURATIONS ---
#define BUTTON_PIN          D1          // Button (Primary RTC Domain)
#define WAKEUP_GPIO         GPIO_NUM_2  // Physical D1 maps to GPIO 2
#define LED_PIN             D6          // NeoPixel data line
#define NUM_PIXELS          1

// --- DYNAMIC PACER INFRASTRUCTURE ---
#define MAX_PATTERN_EVENTS 256
#define MAX_PATTERNS 10

struct HapticEvent {
  unsigned long timeMs;
  char track; // 'L' or 'R'
  byte presetId;
};

struct DynamicPattern {
  char name[32];
  byte colorR;
  byte colorG;
  byte colorB;
  unsigned long durationMs;
  int eventCount;
  HapticEvent events[MAX_PATTERN_EVENTS];
};

DynamicPattern activePatterns[MAX_PATTERNS];
int activePatternCount = 0;
int currentPatternIndex = 0;

Preferences preferences;

// --- DRIVER INSTANCES ---
Adafruit_DRV2605 drvLeft;  
Adafruit_DRV2605 drvRight; 
Adafruit_NeoPixel pixel(NUM_PIXELS, LED_PIN, NEO_GRB + NEO_KHZ800);

// --- COMPOSER SERIAL PROTOCOL BUFFERS ---
#define BUFFER_SIZE 128
char serialBuffer[BUFFER_SIZE];
int bufferIndex = 0;

// State tracking
bool liveComposerActive = false;
unsigned long lastComposerSignalTime = 0;

// --- FUNCTION PROTOTYPES ---
void initHardware();
void runProtocolSelectionMenu();
void runActivePatternEngine();
void runLiveComposerLoop();
void parseSerialCommand(char* cmd);
void updateMenuVisuals();
void confirmSelectionFlash();
void triggerBoth(int id);
void goToDeepSleep();
void loadPatternsFromFlash();
void savePatternsToFlash();
void loadFactoryDefaults();

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=======================================================");
  Serial.println(" Pebble Master Firmware: Active Pacer & Composer Engine");
  Serial.println("=======================================================");

  // Reclaim button pin from low-power RTC domain back to standard digital logic
  rtc_gpio_deinit(WAKEUP_GPIO);
  pinMode(BUTTON_PIN, INPUT_PULLUP); 

  pixel.begin();
  pixel.setBrightness(120); 
  
  initHardware();

  // Load custom patterns from NVS flash
  loadPatternsFromFlash();

  updateMenuVisuals();
}

void loop() {
  if (liveComposerActive) {
    runLiveComposerLoop();
  } else {
    // 1. Enter standalone pacer selection menu
    runProtocolSelectionMenu();
    
    // Check if Menu exited due to serial activation
    if (liveComposerActive) return;

    // 2. Run the selected pacer session
    runActivePatternEngine();
    
    // Check if session exited due to serial activation
    if (liveComposerActive) return;

    // 3. Drop into deep sleep to protect battery
    goToDeepSleep();
  }
}

void initHardware() {
  // Initialize physical buses
  Serial.println("[Wire] Initializing Wire (D4, D5)...");
  Wire.begin(D5, D4); // Left Actuator: SDA = D5, SCL = D4
  Serial.println("[Wire1] Initializing Wire1 (D3, D2)...");
  Wire1.begin(D3, D2, 400000U); // Right Actuator: SDA = D3, SCL = D2

  // Left Driver (Index LRA) - physically mapped to Wire (Left physical pins D4, D5)
  if (drvLeft.begin(&Wire)) {
    drvLeft.selectLibrary(6); // LRA Library 6
    drvLeft.setMode(DRV2605_MODE_INTTRIG);
    Serial.println("[+] Success: Left DRV2605L (Index LRA) Ready on Wire.");
  } else {
    Serial.println("[-] Error: Left DRV2605L not found on Wire.");
  }

  // Right Driver (Thumb LRA) - physically mapped to Wire1 (Right physical pins D3, D2)
  if (drvRight.begin(&Wire1)) {
    drvRight.selectLibrary(6); // LRA Library 6
    drvRight.setMode(DRV2605_MODE_INTTRIG);
    Serial.println("[+] Success: Right DRV2605L (Thumb LRA) Ready on Wire1.");
  } else {
    Serial.println("[-] Error: Right DRV2605L not found on Wire1.");
  }
}

// --- ACTIVE CHECK FOR COMPOSER SERIAL ACTIVATION ---
void checkSerialComposerTraffic() {
  while (Serial.available() > 0) {
    char inChar = (char)Serial.read();
    
    if (inChar == '\n' || inChar == '\r') {
      if (bufferIndex > 0) {
        serialBuffer[bufferIndex] = '\0';
        bufferIndex = 0; // reset
        
        // Mark composer as active and execute command
        liveComposerActive = true;
        lastComposerSignalTime = millis();
        
        parseSerialCommand(serialBuffer);
      }
    } else {
      if (bufferIndex < BUFFER_SIZE - 1) {
        serialBuffer[bufferIndex++] = inChar;
      } else {
        bufferIndex = 0;
      }
    }
  }
}

// --- INTERACTIVE SELECTION MENU (WITH COMPOSER HOOKS) ---
void runProtocolSelectionMenu() {
  unsigned long lastDebounceTime = 0;
  bool lastButtonState = HIGH; 
  
  Serial.println("\n[MENU] Click button to change mode. Hold 1.5s to LOCK IN.");
  Serial.println("[MENU] Connecting Pebble Haptic Composer will override this menu.");

  while (true) {
    checkSerialComposerTraffic();
    if (liveComposerActive) {
      Serial.println("\n[COMPOSER] Switch detected! Hijacking menu for Web Sequencer...");
      return; 
    }

    bool currentButton = digitalRead(BUTTON_PIN);

    // Clean Click Release (LOW -> HIGH) with anti-chatter filter
    if (currentButton == HIGH && lastButtonState == LOW) {
      unsigned long holdDuration = millis() - lastDebounceTime;
      
      if (holdDuration > 50 && holdDuration < 1200) { 
        if (activePatternCount > 0) {
          currentPatternIndex = (currentPatternIndex + 1) % activePatternCount;
          updateMenuVisuals();
          triggerBoth(7); // Preset 7 click indicator
          Serial.print(" -> "); 
          Serial.println(activePatterns[currentPatternIndex].name);
        }
      }
      lastDebounceTime = millis();
    }
    
    // Press Edge (HIGH -> LOW)
    if (currentButton == LOW && lastButtonState == HIGH) {
      lastDebounceTime = millis();
    }

    // Lock Selection after a solid 1.5-second hold
    if (currentButton == LOW && (millis() - lastDebounceTime > 1500)) {
      confirmSelectionFlash();
      while (digitalRead(BUTTON_PIN) == LOW) {
        delay(10);
      }
      delay(200);
      return; 
    }

    lastButtonState = currentButton;
    delay(10);
  }
}

void updateMenuVisuals() {
  if (activePatternCount > 0 && currentPatternIndex < activePatternCount) {
    DynamicPattern& p = activePatterns[currentPatternIndex];
    pixel.setPixelColor(0, pixel.Color(p.colorR, p.colorG, p.colorB));
  } else {
    pixel.setPixelColor(0, pixel.Color(0, 0, 0));
  }
  pixel.show();
}

void confirmSelectionFlash() {
  Serial.println("[START] Standalone Session confirmed!");
  for (int i = 0; i < 3; i++) {
    pixel.setPixelColor(0, pixel.Color(0, 0, 0)); pixel.show(); delay(100);
    updateMenuVisuals();                           pixel.show(); delay(100);
  }
  triggerBoth(12); // Validation rumble
  delay(500);
}

// --- THE REFINED DYNAMIC PACER ENGINE ---
void runActivePatternEngine() {
  if (activePatternCount <= 0 || currentPatternIndex >= activePatternCount) return;

  unsigned long sessionStart = millis();
  unsigned long totalSessionDuration = 600000UL; // 10 Minutes Pacing session
  unsigned long lastElapsed = 0;
  
  DynamicPattern& p = activePatterns[currentPatternIndex];
  Serial.print("[ENGINE] Running custom pacer: ");
  Serial.println(p.name);
  
  pixel.setPixelColor(0, pixel.Color(p.colorR, p.colorG, p.colorB));
  pixel.show();

  while (millis() - sessionStart < totalSessionDuration) {
    checkSerialComposerTraffic();
    if (liveComposerActive) {
      Serial.println("\n[COMPOSER] Command received! Aborting session for Web Sequencer...");
      return; 
    }

    unsigned long now = millis();
    if (p.eventCount == 0 || p.durationMs == 0) {
      // Fallback empty breathe visual (breathing color pattern)
      float breathVal = (sin((float)(now - sessionStart) / 500.0) + 1.0) / 2.0;
      pixel.setPixelColor(0, pixel.Color(
        round(p.colorR * 0.2 + p.colorR * 0.8 * breathVal),
        round(p.colorG * 0.2 + p.colorG * 0.8 * breathVal),
        round(p.colorB * 0.2 + p.colorB * 0.8 * breathVal)
      ));
      pixel.show();
    } else {
      unsigned long elapsed = (now - sessionStart) % p.durationMs;
      bool rolledOver = elapsed < lastElapsed;

      // Loop through events and fire them when crossed in time
      for (int i = 0; i < p.eventCount; i++) {
        HapticEvent& ev = p.events[i];
        bool trigger = false;

        if (rolledOver) {
          if (ev.timeMs >= lastElapsed || ev.timeMs < elapsed) {
            trigger = true;
          }
        } else {
          if (ev.timeMs >= lastElapsed && ev.timeMs < elapsed) {
            trigger = true;
          }
        }

        if (trigger) {
          if (ev.track == 'L') {
            drvLeft.setWaveform(0, ev.presetId);
            drvLeft.setWaveform(1, 0);
            drvLeft.go();
          } else if (ev.track == 'R') {
            drvRight.setWaveform(0, ev.presetId);
            drvRight.setWaveform(1, 0);
            drvRight.go();
          }
        }
      }
      lastElapsed = elapsed;
    }

    // Debounced abort button detector
    if (digitalRead(BUTTON_PIN) == LOW) {
      delay(150); 
      if (digitalRead(BUTTON_PIN) == LOW) {
        Serial.println("[ABORT] Session cancelled.");
        triggerBoth(47); delay(100); triggerBoth(47); 
        while (digitalRead(BUTTON_PIN) == LOW) {
          delay(10);
        }
        delay(200);
        updateMenuVisuals();
        return; 
      }
    }
    delay(1); 
  }
  
  Serial.println("[COMPLETE] Session finished naturally.");
  triggerBoth(11); delay(200); triggerBoth(11);
}

// --- LIVE COMPOSER OPERATIONAL loop ---
void runLiveComposerLoop() {
  Serial.println("\n[COMPOSER] System hijacked. Active Web Sequencer Live-Control Mode!");
  unsigned long startT = millis();

  while (liveComposerActive) {
    unsigned long now = millis();

    // Breathing Teal visual indicator on NeoPixel
    float breathVal = (sin((float)(now - startT) / 500.0) + 1.0) / 2.0;
    int greenVal = 80 + round(breathVal * 120);
    int blueVal = 100 + round(breathVal * 155);
    pixel.setPixelColor(0, pixel.Color(0, greenVal, blueVal));
    pixel.show();

    // High-speed, non-blocking serial check
    while (Serial.available() > 0) {
      char inChar = (char)Serial.read();

      if (inChar == '\n' || inChar == '\r') {
        if (bufferIndex > 0) {
          serialBuffer[bufferIndex] = '\0';
          bufferIndex = 0;
          lastComposerSignalTime = now;
          parseSerialCommand(serialBuffer);
        }
      } else {
        if (bufferIndex < BUFFER_SIZE - 1) {
          serialBuffer[bufferIndex++] = inChar;
        } else {
          bufferIndex = 0;
        }
      }
    }

    // Watchdog Timeout (60s)
    if (now - lastComposerSignalTime > 60000) {
      Serial.println("[COMPOSER] Connection timeout. Exiting Live Composer Mode.");
      liveComposerActive = false;
      triggerBoth(10);
      updateMenuVisuals();
      return;
    }

    // Button exit
    if (digitalRead(BUTTON_PIN) == LOW) {
      delay(50);
      if (digitalRead(BUTTON_PIN) == LOW) {
        Serial.println("[COMPOSER] Disconnecting Web control...");
        liveComposerActive = false;
        triggerBoth(12);
        while(digitalRead(BUTTON_PIN) == LOW) { delay(10); }
        delay(200);
        updateMenuVisuals();
        return;
      }
    }
    delay(1);
  }
}

// --- DYNAMIC PATTERNS SERIAL SERIALIZER / PARSER ---
void parseSerialCommand(char* cmd) {
  if (strlen(cmd) < 3) return;

  char channel = cmd[0];
  if (cmd[1] != ':') return;

  if (channel == 'C' || channel == 'c') {
    char* action = &cmd[2];
    
    // 1. C:READ - Serializes and sends currently active patterns list to App
    if (strncmp(action, "READ", 4) == 0) {
      Serial.print("P:COUNT:"); Serial.println(activePatternCount);
      for (int i = 0; i < activePatternCount; i++) {
        DynamicPattern& p = activePatterns[i];
        Serial.print("P:INFO:");
        Serial.print(i); Serial.print(":");
        Serial.print(p.name); Serial.print(":");
        Serial.print(p.colorR); Serial.print(":");
        Serial.print(p.colorG); Serial.print(":");
        Serial.print(p.colorB); Serial.print(":");
        Serial.print(p.durationMs); Serial.print(":");
        Serial.println(p.eventCount);
        
        for (int j = 0; j < p.eventCount; j++) {
          HapticEvent& ev = p.events[j];
          Serial.print("P:EVENT:");
          Serial.print(i); Serial.print(":");
          Serial.print(ev.timeMs); Serial.print(":");
          Serial.print(ev.track); Serial.print(":");
          Serial.println(ev.presetId);
        }
      }
      Serial.println("P:END");
    }
    
    // 2. C:WRITE:<i>:<name>:<r>:<g>:<b>:<durationMs>:<eventCount>
    else if (strncmp(action, "WRITE:", 6) == 0) {
      char* dataStr = action + 6;
      char* token = strtok(dataStr, ":");
      if (token) {
        int idx = atoi(token);
        if (idx >= 0 && idx < MAX_PATTERNS) {
          if (idx >= activePatternCount) {
            activePatternCount = idx + 1;
          }
          DynamicPattern& p = activePatterns[idx];
          
          token = strtok(NULL, ":");
          if (token) {
            strncpy(p.name, token, 31);
            p.name[31] = '\0';
          }
          token = strtok(NULL, ":");
          if (token) p.colorR = atoi(token);
          token = strtok(NULL, ":");
          if (token) p.colorG = atoi(token);
          token = strtok(NULL, ":");
          if (token) p.colorB = atoi(token);
          token = strtok(NULL, ":");
          if (token) p.durationMs = atol(token);
          token = strtok(NULL, ":");
          if (token) {
            // Event count will accumulate during ADD_EVENT
            p.eventCount = 0; 
          }
          Serial.print("[LOADER] Syncing meta for pattern ");
          Serial.print(idx); Serial.print(": "); Serial.println(p.name);
        }
      }
    }
    
    // 3. C:ADD_EVENT:<i>:<timeMs>:<track>:<presetId>
    else if (strncmp(action, "ADD_EVENT:", 10) == 0) {
      char* dataStr = action + 10;
      char* token = strtok(dataStr, ":");
      if (token) {
        int idx = atoi(token);
        if (idx >= 0 && idx < activePatternCount) {
          DynamicPattern& p = activePatterns[idx];
          
          token = strtok(NULL, ":");
          unsigned long timeMs = token ? atol(token) : 0;
          token = strtok(NULL, ":");
          char track = token ? token[0] : 'L';
          token = strtok(NULL, ":");
          byte presetId = token ? atoi(token) : 1;
          
          if (p.eventCount < MAX_PATTERN_EVENTS) {
            p.events[p.eventCount++] = { timeMs, track, presetId };
          }
        }
      }
    }
    
    // 4. C:SAVE
    else if (strncmp(action, "SAVE", 4) == 0) {
      savePatternsToFlash();
      triggerBoth(12); // Confirm sync pacer double rumble
      Serial.println("[LOADER] Patterns updated and saved in NVS.");
    }
    
    // 5. C:DELETE:<i>
    else if (strncmp(action, "DELETE:", 7) == 0) {
      int delIdx = atoi(action + 7);
      if (delIdx >= 0 && delIdx < activePatternCount) {
        Serial.print("[LOADER] Deleting pattern index "); Serial.println(delIdx);
        for (int i = delIdx; i < activePatternCount - 1; i++) {
          activePatterns[i] = activePatterns[i + 1];
        }
        activePatternCount--;
        if (currentPatternIndex >= activePatternCount) {
          currentPatternIndex = 0;
        }
        savePatternsToFlash();
        updateMenuVisuals();
        triggerBoth(10); // double-tick alert
      }
    }
    
    // 6. C:RESET_DEFAULTS
    else if (strncmp(action, "RESET_DEFAULTS", 14) == 0) {
      loadFactoryDefaults();
      currentPatternIndex = 0;
      updateMenuVisuals();
      triggerBoth(12);
      Serial.println("[LOADER] Factory defaults restored.");
      
      // Auto report new list back
      Serial.print("P:COUNT:"); Serial.println(activePatternCount);
      for (int i = 0; i < activePatternCount; i++) {
        DynamicPattern& p = activePatterns[i];
        Serial.print("P:INFO:");
        Serial.print(i); Serial.print(":");
        Serial.print(p.name); Serial.print(":");
        Serial.print(p.colorR); Serial.print(":");
        Serial.print(p.colorG); Serial.print(":");
        Serial.print(p.colorB); Serial.print(":");
        Serial.print(p.durationMs); Serial.print(":");
        Serial.println(p.eventCount);
        for (int j = 0; j < p.eventCount; j++) {
          HapticEvent& ev = p.events[j];
          Serial.print("P:EVENT:");
          Serial.print(i); Serial.print(":");
          Serial.print(ev.timeMs); Serial.print(":");
          Serial.print(ev.track); Serial.print(":");
          Serial.println(ev.presetId);
        }
      }
      Serial.println("P:END");
    }
    return;
  }

  // Real-time live control execution triggers LRA
  int presetId = atoi(&cmd[2]);
  if (presetId < 1 || presetId > 123) return;

  if (channel == 'L' || channel == 'l') {
    drvLeft.setWaveform(0, presetId);
    drvLeft.setWaveform(1, 0);
    drvLeft.go();
  } else if (channel == 'R' || channel == 'r') {
    drvRight.setWaveform(0, presetId);
    drvRight.setWaveform(1, 0);
    drvRight.go();
  }
}

void loadPatternsFromFlash() {
  preferences.begin("haptics", true); // Read-only
  activePatternCount = preferences.getInt("count", 0);
  
  if (activePatternCount <= 0 || activePatternCount > MAX_PATTERNS) {
    preferences.end();
    loadFactoryDefaults();
  } else {
    for (int i = 0; i < activePatternCount; i++) {
      String key = "pat_" + String(i);
      preferences.getBytes(key.c_str(), &activePatterns[i], sizeof(DynamicPattern));
    }
    preferences.end();
    Serial.print("[FLASH] Loaded patterns list from Flash. Count: ");
    Serial.println(activePatternCount);
  }
}

void savePatternsToFlash() {
  preferences.begin("haptics", false); // Read/Write
  preferences.putInt("count", activePatternCount);
  for (int i = 0; i < activePatternCount; i++) {
    String key = "pat_" + String(i);
    preferences.putBytes(key.c_str(), &activePatterns[i], sizeof(DynamicPattern));
  }
  preferences.end();
  Serial.println("[FLASH] Saved patterns list to NVS Flash.");
}

void loadFactoryDefaults() {
  Serial.println("[SYSTEM] Restoring Factory Default Pacing Patterns...");
  activePatternCount = 4;
  
  // 1. FOCUS (Box Breathing)
  strcpy(activePatterns[0].name, "Focus Pacer");
  activePatterns[0].colorR = 0;
  activePatterns[0].colorG = 0;
  activePatterns[0].colorB = 255;
  activePatterns[0].durationMs = BOX_DURATION;
  activePatterns[0].eventCount = BOX_EVENT_COUNT;
  for (int i = 0; i < BOX_EVENT_COUNT; i++) {
    activePatterns[0].events[i].timeMs = pgm_read_dword(&(BOX_EVENTS[i].timeMs));
    activePatterns[0].events[i].track = pgm_read_byte(&(BOX_EVENTS[i].track));
    activePatterns[0].events[i].presetId = pgm_read_byte(&(BOX_EVENTS[i].presetId));
  }

  // 2. SLEEP (4-7-8)
  strcpy(activePatterns[1].name, "Sleep Pacer");
  activePatterns[1].colorR = 130;
  activePatterns[1].colorG = 0;
  activePatterns[1].colorB = 255;
  activePatterns[1].durationMs = SLEEP_DURATION;
  activePatterns[1].eventCount = SLEEP_EVENT_COUNT;
  for (int i = 0; i < SLEEP_EVENT_COUNT; i++) {
    activePatterns[1].events[i].timeMs = pgm_read_dword(&(SLEEP_EVENTS[i].timeMs));
    activePatterns[1].events[i].track = pgm_read_byte(&(SLEEP_EVENTS[i].track));
    activePatterns[1].events[i].presetId = pgm_read_byte(&(SLEEP_EVENTS[i].presetId));
  }

  // 3. RELAX (4-6)
  strcpy(activePatterns[2].name, "Relax Pacer");
  activePatterns[2].colorR = 0;
  activePatterns[2].colorG = 255;
  activePatterns[2].colorB = 100;
  activePatterns[2].durationMs = RELAX_DURATION;
  activePatterns[2].eventCount = RELAX_EVENT_COUNT;
  for (int i = 0; i < RELAX_EVENT_COUNT; i++) {
    activePatterns[2].events[i].timeMs = pgm_read_dword(&(RELAX_EVENTS[i].timeMs));
    activePatterns[2].events[i].track = pgm_read_byte(&(RELAX_EVENTS[i].track));
    activePatterns[2].events[i].presetId = pgm_read_byte(&(RELAX_EVENTS[i].presetId));
  }

  // 4. PRESENCE (Coherence)
  strcpy(activePatterns[3].name, "Coherence Pacer");
  activePatterns[3].colorR = 255;
  activePatterns[3].colorG = 100;
  activePatterns[3].colorB = 0;
  activePatterns[3].durationMs = PRESENCE_DURATION;
  activePatterns[3].eventCount = PRESENCE_EVENT_COUNT;
  for (int i = 0; i < PRESENCE_EVENT_COUNT; i++) {
    activePatterns[3].events[i].timeMs = pgm_read_dword(&(PRESENCE_EVENTS[i].timeMs));
    activePatterns[3].events[i].track = pgm_read_byte(&(PRESENCE_EVENTS[i].track));
    activePatterns[3].events[i].presetId = pgm_read_byte(&(PRESENCE_EVENTS[i].presetId));
  }
  
  savePatternsToFlash();
}

void goToDeepSleep() {
  Serial.println("[POWER] Initializing Deep Standby...");
  Serial.flush();
  pixel.setPixelColor(0, pixel.Color(0, 0, 0));
  pixel.show();
  
  while(digitalRead(BUTTON_PIN) == LOW) {
    delay(10);
  }
  delay(250); 

  esp_sleep_enable_ext0_wakeup(WAKEUP_GPIO, 0); 
  rtc_gpio_pullup_en(WAKEUP_GPIO);     
  rtc_gpio_pulldown_dis(WAKEUP_GPIO);  
  esp_deep_sleep_start();
}

void triggerBoth(int id) {
  drvLeft.setWaveform(0, id);  drvLeft.setWaveform(1, 0);  drvLeft.go();
  drvRight.setWaveform(0, id); drvRight.setWaveform(1, 0); drvRight.go();
}