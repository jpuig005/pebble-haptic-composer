/**
 * =============================================================================
 * Pebble Haptic Composer - Integrated Master Firmware
 * =============================================================================
 * Supported Hardware: Seeed Studio XIAO ESP32-S3
 * Breakout Modules: Dual Adafruit DRV2605L Haptic Controllers + 1x NeoPixel
 * * Features Dual Operational Modes:
 * 1. STANDALONE PACER MODE (Breathing Trainer & Offline Player)
 * - Cycles through Focus, Sleep, Relax, Presence, and CUSTOM breathing protocols.
 * - Uses single button clicks to choose modes, hold 1.5s to lock in.
 * - Auto deep sleep (RTC) after session ends or is cancelled.
 * * 2. LIVE COMPOSER MODE (Web Sequencer Companion)
 * - Activates instantly when a serial command arrives from the web editor.
 * - Turns NeoPixel into a breathing teal status indicator.
 * - Parses trigger packets (e.g., L:7\n or R:24\n) in a non-blocking loop.
 * - Press the button physically at any time to return to Standalone Pacer.
 * * Pinout Config (Matching physical device):
 * - Left Channel (Index LRA): Wire.begin(D4, D5)
 * - Right Channel (Thumb LRA): Wire1.begin(D3, D2, 400000U)
 * - Button Pin: D1 (WAKEUP_GPIO: GPIO 2)
 * - NeoPixel LED: D6 (NUM_PIXELS: 1)
 * =============================================================================
 */

#include <Wire.h>
#include <Adafruit_DRV2605.h>
#include <Adafruit_NeoPixel.h>
#include "driver/rtc_io.h"
#include <math.h>
#include <Preferences.h> // Non-volatile flash storage for custom patterns
#include "presets_data.h" // Compiled JSON sequence data from DAW

// --- PIN CONFIGURATIONS ---
#define BUTTON_PIN          D1          // Button (Primary RTC Domain)
#define WAKEUP_GPIO         GPIO_NUM_2  // Physical D1 maps to GPIO 2
#define LED_PIN             D6          // NeoPixel data line
#define NUM_PIXELS          1

// --- STANDALONE BREATHING PACER INFRASTRUCTURE ---
enum Protocol { FOCUS, SLEEP, RELAX, PRESENCE, CUSTOM, NUM_PROTOCOLS };
Protocol currentProtocol = FOCUS;

const unsigned long protocolTimers[NUM_PROTOCOLS][4] = {
  {4000, 4000, 4000, 4000}, // 1. FOCUS (Box Breathing: 4-4-4-4)
  {4000, 7000, 8000,    0}, // 2. SLEEP (4-7-8)
  {4000,    0, 6000,    0}, // 3. RELAX (4-6)
  {5500,    0, 5500,    0}, // 4. PRESENCE (Coherence: 5.5s / 5.5s)
  {0,       0,    0,    0}  // 5. CUSTOM (Offline play - timers not used)
};

// --- CUSTOM PACER PATTERN INFRASTRUCTURE ---
struct HapticEvent {
  unsigned long timeMs;
  char track; // 'L' or 'R'
  byte presetId;
};

#define MAX_CUSTOM_EVENTS 512
HapticEvent customPattern[MAX_CUSTOM_EVENTS];
int customEventCount = 0;
unsigned long customPatternDuration = 10000; // default 10 seconds

Preferences preferences;

// --- DRIVER INSTANCES ---
Adafruit_DRV2605 drvLeft;  
Adafruit_DRV2605 drvRight; 
Adafruit_NeoPixel pixel(NUM_PIXELS, LED_PIN, NEO_GRB + NEO_KHZ800);

// --- COMPOSER SERIAL PROTOCOL BUFFERS ---
#define BUFFER_SIZE 64
char serialBuffer[BUFFER_SIZE];
int bufferIndex = 0;

// State tracking
bool liveComposerActive = false;
unsigned long lastComposerSignalTime = 0;

// --- FUNCTION PROTOTYPES ---
void initHardware();
void runProtocolSelectionMenu();
void runBreathingEngine();
void runCustomPatternEngine();
void runLiveComposerLoop();
void parseSerialCommand(char* cmd);
void updateMenuVisuals();
void printCurrentProtocolName();
void confirmSelectionFlash();
void triggerBoth(int id);
void goToDeepSleep();

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

  // Load custom offline pattern from NVS flash
  preferences.begin("haptics", true); // Open namespace 'haptics' in read-only
  customEventCount = preferences.getInt("count", 0);
  customPatternDuration = preferences.getLong("duration", 10000);
  if (customEventCount > 0 && customEventCount <= MAX_CUSTOM_EVENTS) {
    preferences.getBytes("pattern", customPattern, sizeof(customPattern));
  }
  preferences.end();

  Serial.print("[BOOT] Loaded custom offline events: ");
  Serial.println(customEventCount);

  updateMenuVisuals();
}

void loop() {
  // If we receive a command from the serial port, go straight to Live Composer Mode
  if (liveComposerActive) {
    runLiveComposerLoop();
  } else {
    // 1. Enter standalone pacer selection menu
    runProtocolSelectionMenu();
    
    // Check if Menu exited due to serial activation
    if (liveComposerActive) return;

    // 2. Run the standalone breathing or custom pacer session
    if (currentProtocol == CUSTOM) {
      runCustomPatternEngine();
    } else {
      runBreathingEngine();
    }
    
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
    
    // Buffer inputs
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
    // Proactively check if Web Serial is trying to take control
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
        currentProtocol = static_cast<Protocol>((currentProtocol + 1) % NUM_PROTOCOLS);
        updateMenuVisuals();
        
        triggerBoth(7); // Preset 7 click indicator
        printCurrentProtocolName();
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
      
      // Wait for button release before starting the engine to prevent immediate abort
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
  switch (currentProtocol) {
    case FOCUS:    pixel.setPixelColor(0, pixel.Color(0, 0, 255));   break; // Pure Blue
    case SLEEP:    pixel.setPixelColor(0, pixel.Color(130, 0, 255)); break; // Purple
    case RELAX:    pixel.setPixelColor(0, pixel.Color(0, 255, 100)); break; // Emerald
    case PRESENCE: pixel.setPixelColor(0, pixel.Color(255, 100, 0)); break; // Amber
    case CUSTOM:   pixel.setPixelColor(0, pixel.Color(0, 240, 255)); break; // Teal/Cyan!
  }
  pixel.show();
}

void printCurrentProtocolName() {
  switch (currentProtocol) {
    case FOCUS:    Serial.println(" -> FOCUS (Box Breathing 4-4-4-4)"); break;
    case SLEEP:    Serial.println(" -> SLEEP (4-7-8)"); break;
    case RELAX:    Serial.println(" -> RELAX (4-6)"); break;
    case PRESENCE: Serial.println(" -> PRESENCE (5.5s / 5.5s)"); break;
    case CUSTOM:   Serial.println(" -> CUSTOM (Synchronized Pattern offline)"); break;
  }
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

/// --- THE REFINED Standalone PACER ENGINE (Unified static sequence player) ---
void runBreathingEngine() {
  const PresetEvent* events = nullptr;
  int eventCount = 0;
  unsigned long duration = 0;
  String name = "";
  
  switch (currentProtocol) {
    case FOCUS:
      events = BOX_EVENTS;
      eventCount = BOX_EVENT_COUNT;
      duration = BOX_DURATION;
      name = "FOCUS (Box)";
      break;
    case SLEEP:
      events = SLEEP_EVENTS;
      eventCount = SLEEP_EVENT_COUNT;
      duration = SLEEP_DURATION;
      name = "SLEEP";
      break;
    case RELAX:
      events = RELAX_EVENTS;
      eventCount = RELAX_EVENT_COUNT;
      duration = RELAX_DURATION;
      name = "RELAX";
      break;
    case PRESENCE:
      events = PRESENCE_EVENTS;
      eventCount = PRESENCE_EVENT_COUNT;
      duration = PRESENCE_DURATION;
      name = "PRESENCE (Coherent)";
      break;
    default:
      return;
  }

  unsigned long sessionStart = millis();
  unsigned long totalSessionDuration = 600000UL; // 10 Minutes Pacing session
  unsigned long lastElapsed = 0;
  
  Serial.print("[ENGINE] Running custom compiled standalone sequence: ");
  Serial.println(name);

  while (millis() - sessionStart < totalSessionDuration) {
    // Proactively check if Web Serial is trying to hijack
    checkSerialComposerTraffic();
    if (liveComposerActive) {
      Serial.println("\n[COMPOSER] Command received! Aborting standalone session for Web Sequencer...");
      return; 
    }

    unsigned long now = millis();
    if (eventCount == 0 || duration == 0) {
      // Fallback empty breathe visual
      float breathVal = (sin((float)(now - sessionStart) / 500.0) + 1.0) / 2.0;
      pixel.setPixelColor(0, pixel.Color(0, 50 + round(breathVal * 50), 100 + round(breathVal * 100)));
      pixel.show();
    } else {
      unsigned long elapsed = (now - sessionStart) % duration;
      
      // Check loop rollover
      bool rolledOver = elapsed < lastElapsed;

      // Loop through events and fire them when crossed in time
      for (int i = 0; i < eventCount; i++) {
        // Read struct from PROGMEM (Flash Memory) securely to shield RAM
        unsigned long evTime = pgm_read_dword(&(events[i].timeMs));
        char evTrack = pgm_read_byte(&(events[i].track));
        byte evPreset = pgm_read_byte(&(events[i].presetId));
        
        if (evPreset == 0) continue; // Skip empty structural padding
        
        bool trigger = false;

        if (rolledOver) {
          // Rolled over: trigger if event is after lastElapsed OR before current elapsed
          if (evTime >= lastElapsed || evTime < elapsed) {
            trigger = true;
          }
        } else {
          // Standard progression: trigger if event is crossed between lastElapsed and current elapsed
          if (evTime >= lastElapsed && evTime < elapsed) {
            trigger = true;
          }
        }

        if (trigger) {
          if (evTrack == 'L') {
            drvLeft.setWaveform(0, evPreset);
            drvLeft.setWaveform(1, 0);
            drvLeft.go();
          } else if (evTrack == 'R') {
            drvRight.setWaveform(0, evPreset);
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
        
        // Wait for button release
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

// --- DYNAMIC CUSTOM PATTERN ENGINE ---
void runCustomPatternEngine() {
  unsigned long sessionStart = millis();
  unsigned long totalSessionDuration = 600000UL; // 10 Minutes Pacing session
  unsigned long lastElapsed = 0;

  Serial.println("[ENGINE] Running custom offline haptic sequence...");
  
  // Set NeoPixel status: static Teal glow to show offline custom mode
  pixel.setPixelColor(0, pixel.Color(0, 240, 255));
  pixel.show();

  while (millis() - sessionStart < totalSessionDuration) {
    // Proactively check if Web Serial is trying to hijack
    checkSerialComposerTraffic();
    if (liveComposerActive) {
      Serial.println("\n[COMPOSER] Command received! Aborting custom session for Web Sequencer...");
      return; 
    }

    unsigned long now = millis();

    if (customEventCount == 0) {
      // Empty pattern - just idle breathe NeoPixel
      float breathVal = (sin((float)(now - sessionStart) / 500.0) + 1.0) / 2.0;
      pixel.setPixelColor(0, pixel.Color(0, 50 + round(breathVal * 50), 100 + round(breathVal * 100)));
      pixel.show();
    } else {
      unsigned long elapsed = (now - sessionStart) % customPatternDuration;
      
      // Check loop rollover
      bool rolledOver = elapsed < lastElapsed;

      // Loop through events and fire them when crossed in time
      for (int i = 0; i < customEventCount; i++) {
        HapticEvent& ev = customPattern[i];
        bool trigger = false;

        if (rolledOver) {
          // Rolled over: trigger if event is after lastElapsed OR before current elapsed
          if (ev.timeMs >= lastElapsed || ev.timeMs < elapsed) {
            trigger = true;
          }
        } else {
          // Standard progression: trigger if event is crossed between lastElapsed and current elapsed
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

    // Debounced abort button detector (ALWAYS checked, even if customEventCount == 0!)
    if (digitalRead(BUTTON_PIN) == LOW) {
      delay(150); 
      if (digitalRead(BUTTON_PIN) == LOW) {
        Serial.println("[ABORT] Custom session cancelled.");
        triggerBoth(47); delay(100); triggerBoth(47); 
        
        // Wait for button release
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

// =============================================================================
// --- LIVE COMPOSER OPERATIONAL ENGINE ---
// =============================================================================
void runLiveComposerLoop() {
  Serial.println("\n[COMPOSER] System hijacked. Active Web Sequencer Live-Control Mode!");
  
  // Set NeoPixel status: breathing teal glow to show active web connection
  unsigned long startT = millis();

  while (liveComposerActive) {
    unsigned long now = millis();

    // 1. Dynamic breathing Teal visual indicator on NeoPixel
    float breathVal = (sin((float)(now - startT) / 500.0) + 1.0) / 2.0; // 0.0 to 1.0
    int greenVal = 80 + round(breathVal * 120);
    int blueVal = 100 + round(breathVal * 155);
    pixel.setPixelColor(0, pixel.Color(0, greenVal, blueVal));
    pixel.show();

    // 2. High-speed, non-blocking serial character check
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

    // 3. Safety Watchdog: If no serial packets for 60 seconds, return to normal menu
    if (now - lastComposerSignalTime > 60000) {
      Serial.println("[COMPOSER] Connection timeout (60s). Exiting Live Composer Mode.");
      liveComposerActive = false;
      triggerBoth(10); // alert ticks
      updateMenuVisuals();
      return;
    }

    // 4. Physical button override: press button to instantly disconnect and return to menu
    if (digitalRead(BUTTON_PIN) == LOW) {
      delay(50); // small filter
      if (digitalRead(BUTTON_PIN) == LOW) {
        Serial.println("[COMPOSER] Button pressed! Disconnecting Web control and returning to menu.");
        liveComposerActive = false;
        triggerBoth(12); // clean double rumble
        
        // Wait for button release
        while(digitalRead(BUTTON_PIN) == LOW) { delay(10); }
        delay(200);

        updateMenuVisuals();
        return;
      }
    }
    
    delay(1); // minimal task yielding
  }
}

/**
 * Decodes the incoming command and dispatches haptic commands or configures sync loading.
 * Realtime format: "L:7\n" or "R:24\n"
 * Control format: "C:CLEAR\n", "C:DUR:<durationMs>\n", "C:ADD:<timeMs>:<track>:<presetId>\n", "C:SAVE\n"
 */
void parseSerialCommand(char* cmd) {
  if (strlen(cmd) < 3) return;

  char channel = cmd[0];
  if (cmd[1] != ':') return;

  // Control/Custom sync loading command path
  if (channel == 'C' || channel == 'c') {
    char* action = &cmd[2];
    
    if (strncmp(action, "CLEAR", 5) == 0) {
      customEventCount = 0;
      Serial.println("[LOADER] Standalone buffer cleared.");
    }
    else if (strncmp(action, "DUR:", 4) == 0) {
      customPatternDuration = atol(action + 4);
      Serial.print("[LOADER] Duration set: "); Serial.println(customPatternDuration);
    }
    else if (strncmp(action, "ADD:", 4) == 0) {
      // Format: ADD:timeMs:track:presetId (e.g. ADD:1500:L:7)
      char* timePart = action + 4;
      char* trackPart = strchr(timePart, ':');
      if (trackPart) {
        *trackPart = '\0';
        trackPart++;
        char* presetPart = strchr(trackPart, ':');
        if (presetPart) {
          *presetPart = '\0';
          presetPart++;
          
          unsigned long tMs = atol(timePart);
          char trk = trackPart[0];
          int pId = atoi(presetPart);
          
          if (customEventCount < MAX_CUSTOM_EVENTS) {
            customPattern[customEventCount++] = { tMs, trk, (byte)pId };
          }
        }
      }
    }
    else if (strncmp(action, "SAVE", 4) == 0) {
      // Chronological bubble-sort to ensure linear high-speed playback sweeps
      for (int i = 0; i < customEventCount - 1; i++) {
        for (int j = 0; j < customEventCount - i - 1; j++) {
          if (customPattern[j].timeMs > customPattern[j+1].timeMs) {
            HapticEvent temp = customPattern[j];
            customPattern[j] = customPattern[j+1];
            customPattern[j+1] = temp;
          }
        }
      }
      
      // Flush array to ESP32 Flash Memory (NVS Preferences)
      preferences.begin("haptics", false);
      preferences.putInt("count", customEventCount);
      preferences.putLong("duration", customPatternDuration);
      preferences.putBytes("pattern", customPattern, customEventCount * sizeof(HapticEvent));
      preferences.end();
      
      Serial.print("[LOADER] Sequence synced & saved to Flash. Events: ");
      Serial.println(customEventCount);
      triggerBoth(12); // Short vibration confirmation double-rumble
    }
    return;
  }

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

// --- SECURE DEEP SLEEP ROUTINE ---
void goToDeepSleep() {
  Serial.println("[POWER] Initializing Deep Standby to conserve battery...");
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