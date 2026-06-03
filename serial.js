/**
 * serial.js
 * Interfaces with the Web Serial API to transmit haptic trigger commands in real time.
 */

class SerialManager {
  constructor() {
    this.port = null;
    this.writer = null;
    this.encoder = new TextEncoder();
    this.isConnected = false;
    this.onStatusChangeCallback = null;
  }

  onStatusChange(callback) {
    this.onStatusChangeCallback = callback;
  }

  _updateStatus(connected) {
    this.isConnected = connected;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(connected);
    }
  }

  /**
   * Triggers the browser serial port picker and establishes connection at 115200 baud.
   */
  async connect() {
    if (!("serial" in navigator)) {
      alert("Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.");
      return false;
    }

    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });
      
      this.writer = this.port.writable.getWriter();
      this._updateStatus(true);
      
      // Watch for sudden disconnections
      navigator.serial.addEventListener("disconnect", (event) => {
        if (event.port === this.port) {
          this.disconnect();
        }
      });

      console.log("Web Serial connected successfully.");
      return true;
    } catch (err) {
      console.error("Web Serial connection failed:", err);
      this.disconnect();
      return false;
    }
  }

  /**
   * Closes active serial streams and releases resources.
   */
  async disconnect() {
    try {
      if (this.writer) {
        this.writer.releaseLock();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (err) {
      console.error("Error during serial disconnect:", err);
    } finally {
      this._updateStatus(false);
      console.log("Web Serial disconnected.");
    }
  }

  /**
   * Formats and transmits a trigger packet.
   * Format: "L:<presetId>\n" for Left/Index or "R:<presetId>\n" for Right/Thumb
   * @param {string} driver - "L" or "R"
   * @param {number} presetId - TI DRV2605L Preset Waveform ID (1 to 123)
   */
  async transmit(driver, presetId) {
    if (!this.isConnected || !this.writer) {
      console.warn(`Serial not connected. Packet dropped: ${driver}:${presetId}`);
      return;
    }

    const payload = `${driver}:${presetId}\n`;
    try {
      const data = this.encoder.encode(payload);
      await this.writer.write(data);
      console.log(`[Serial Tx] ${payload.trim()}`);
    } catch (err) {
      console.error("Serial write failed, disconnecting device.", err);
      this.disconnect();
    }
  }

  /**
   * Transmits a raw string command over serial.
   * @param {string} payload - Raw custom command to write
   */
  async writeString(payload) {
    if (!this.isConnected || !this.writer) {
      console.warn("Serial not connected. Cannot write string.");
      return;
    }

    try {
      const data = this.encoder.encode(payload);
      await this.writer.write(data);
      console.log(`[Serial Tx Raw] ${payload.trim()}`);
    } catch (err) {
      console.error("Serial write failed, disconnecting device.", err);
      this.disconnect();
    }
  }
}

export const serialManager = new SerialManager();
