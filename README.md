# 🌬️ Breathing Pebble Composer
> Companion Web DAW & ESP32-S3 Firmware for the **"Gadgets for Your Psyche"** Universe.

---

## 🔬 About the Breathing Pebble
The **Breathing Pebble** is a tactile biofeedback and nervous system regulation gadget. It is a physical, handheld ritual object designed to help users synchronize their breathing with custom-arranged haptic vibration patterns. 

This repository contains the full source code for:
1. **The Web DAW Composer**: A premium, studio-like web sequencer interface to sculpt, drag, batch-edit, and preview haptic pacing patterns in real-time.
2. **The custom ESP32-S3 Firmware**: Non-blocking Arduino code for the Seeed Studio XIAO ESP32-S3 which operates the dual haptic drivers and handles offline pacer sessions.

---

## 🎨 Creative Studio UI & Aesthetic
The web application is designed as a dimly lit creative studio workshop—blending soft neuroscience, engineering precision, and tactile maker objects:
* **Organic Shape Language**: Timelines, controllers, and sliders mimic smooth, carved pebble shapes.
* **Warm Amber & Gold (`#e5a93b`)**: Dedicated to the **Index LRA** representing the ascending, sharper **Inhale Phase**.
* **Mossy Teal (`#569890`)**: Dedicated to the **Thumb LRA** representing the smooth, decaying **Exhale Phase**.
* **Poetic Instrument Control**: Poetic but precise hardware microcopy (e.g. *"Signal Texture"*, *"Dormant Heartbeat"*, *"Send to Pebble"*).

---

## 🎛️ Web DAW Features
* **Grid Sequencer**: Arrange haptic trigger blocks along two LRA driver channels with precision grid snapping.
* **Marquee Multi-Selection & Dragging**: Click-and-drag bounding boxes to select, batch-edit, copy, paste, or slide groups of nodes in unison.
* **Curve Generator Mode**: Mathematically calculate triggers using Gaussian, Sine, or Linear envelopes, or draw automation curves directly on the canvas ruler.
* **Undo & Redo Command Stack**: Full keyboard hook integration (`Cmd/Ctrl+Z` and `Cmd/Ctrl+Shift+Z`) with batch action grouping.
* **Live-Test Playback**: Stream sequences in real-time using Google Chrome's native **Web Serial API**.
* **Offline Flash Sync**: Compile and push custom sequences directly into the Pebble's non-volatile flash memory for unplugged standalone sessions.

---

## 🔌 Hardware Configurations
* **Microcontroller**: Seeed Studio XIAO ESP32-S3
* **Haptic Controllers**: 2x Adafruit DRV2605L Haptic Motor Drivers (acting in LRA mode)
* **Status Indicator**: 1x Addressable WS2812B NeoPixel LED
* **Physical Pinout Config**:
  * **Left Channel (Index LRA)**: SDA = `D4`, SCL = `D5` (Wire)
  * **Right Channel (Thumb LRA)**: SDA = `D3`, SCL = `D2` (Wire1, 400kHz)
  * **Physical Override Button**: `D1` (GPIO 2, supports low-power RTC wakeup)
  * **Status NeoPixel**: `D6`

---

## 📁 Repository Structure
```
├── src/ / public/           # Source assets and web app code
├── dist/                    # Compiled production static bundle
├── firmware/
│   ├── sequences/           # Place your exported JSON sequences here
│   │   ├── relax.json       # Custom 4-6 pacing
│   │   ├── sleep.json       # Sleep pacer
│   │   ├── box.json         # Box breathing
│   │   └── presence.json    # Coherent presence
│   ├── pebble_haptic_composer/
│   │   ├── pebble_haptic_composer.ino  # ESP32-S3 Master Firmware
│   │   └── presets_data.h   # Auto-compiled haptic event arrays
│   └── generate_presets.py  # Python script parsing JSON to C++ arrays
├── package.json
└── vite.config.js
```

---

## ⚡ Setup & Workflow

### 1. Web Application Setup
Ensure you have [Node.js](https://nodejs.org/) installed:
```bash
# Install dependencies
npm install

# Run the local development server (Hot Reload enabled)
npm run dev

# Compile the production bundle inside dist/
npm run build
```

### 2. Standalone Preset Compilation
When you design your ideal pacers in the Web DAW, export them to your computer, and place them inside the `firmware/sequences/` folder.

To inject your custom JSON sequences directly into the hardware code, run:
```bash
npm run compile-presets
```
This compiles the JSON files, sorts all events chronologically, formats them as `PROGMEM` data, and automatically updates `presets_data.h` inside the Arduino sketch folder.

### 3. Uploading Firmware
1. Open the [firmware/pebble_haptic_composer/](firmware/pebble_haptic_composer/) folder in the Arduino IDE.
2. Install the **Adafruit DRV2605L Library** and **Adafruit NeoPixel Library** via the Library Manager.
3. Select your board (**Seeed Studio XIAO ESP32S3**).
4. Connect your Pebble via a USB data cable and hit **Upload**!
