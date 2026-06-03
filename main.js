/**
 * main.js
 * Master orchestrator of the Pebble Haptic Composer frontend.
 * Integrates Library lists, Web Serial connection lifecycle, Timeline actions, and the Node Inspector panel.
 */

import { FAMILIES, PRESETS, PRESETS_BY_FAMILY } from "./presets.js";
import { HapticSequencer } from "./sequencer.js";
import { serialManager } from "./serial.js";

document.addEventListener("DOMContentLoaded", () => {
  // Elements Lookups
  const connectBtn = document.getElementById("connectBtn");
  const syncBtn = document.getElementById("syncBtn");
  const connectionStatus = document.getElementById("connectionStatus");
  const playBtn = document.getElementById("playBtn");
  const stopBtn = document.getElementById("stopBtn");
  const loopBtn = document.getElementById("loopBtn");
  const sequenceLengthInput = document.getElementById("sequenceLength");
  const importBtn = document.getElementById("importBtn");
  const exportBtn = document.getElementById("exportBtn");
  const clearBtn = document.getElementById("clearBtn");
  const fileInput = document.getElementById("fileInput");
  const zoomSlider = document.getElementById("zoomSlider");

  // Mode selectors & panels
  const modeManualBtn = document.getElementById("modeManualBtn");
  const modeCurveBtn = document.getElementById("modeCurveBtn");
  const leftPanelHeader = document.getElementById("leftPanelHeader");
  const presetsLibrary = document.getElementById("presetsLibrary");
  const generatorSidebar = document.getElementById("generatorSidebar");
  const rulerCurveSvg = document.getElementById("rulerCurveSvg");

  // Curve Mode inputs
  const breathPreset = document.getElementById("breathPreset");
  const curveShape = document.getElementById("curveShape");
  const curveBaseInterval = document.getElementById("curveBaseInterval");
  const curvePeakInterval = document.getElementById("curvePeakInterval");
  const curveCrestPosition = document.getElementById("curveCrestPosition");
  const crestPosDisplay = document.getElementById("crestPosDisplay");
  const curveRouting = document.getElementById("curveRouting");
  const curvePreset = document.getElementById("curvePreset");
  const curveDynamicIntensity = document.getElementById("curveDynamicIntensity");

  // Record mode and vault bindings
  const recordBtn = document.getElementById("recordBtn");
  const saveToDbBtn = document.getElementById("saveToDbBtn");
  const savedSequencesList = document.getElementById("savedSequencesList");
  let isRecording = false;

  // Active editor mode ('manual' or 'curve')
  let activeMode = "manual";

  // Inspector Elements
  const inspectorEmpty = document.getElementById("inspectorEmpty");
  const inspectorForm = document.getElementById("inspectorForm");
  const nodePresetFamily = document.getElementById("nodePresetFamily");
  const nodePresetMeta = document.getElementById("nodePresetMeta");
  const inspectStartTime = document.getElementById("inspectStartTime");
  const inspectTrack = document.getElementById("inspectTrack");
  const intensityTiersGrid = document.getElementById("intensityTiersGrid");
  const intensitySection = document.getElementById("intensitySection");
  const inspectTestBtn = document.getElementById("inspectTestBtn");
  const inspectDeleteBtn = document.getElementById("inspectDeleteBtn");

  // Pebble State & UI Elements
  let pebblePatterns = [];
  let tempPebblePatterns = [];
  let selectedPatternIdx = null;

  const pebbleConnectionBadge = document.getElementById("pebbleConnectionBadge");
  const pebblePatternsContainer = document.getElementById("pebblePatternsContainer");
  const pebbleAddBtn = document.getElementById("pebbleAddBtn");
  const pebbleResetBtn = document.getElementById("pebbleResetBtn");

  const patternInspectorForm = document.getElementById("patternInspectorForm");
  const patternNameInput = document.getElementById("patternNameInput");
  const patternColorInput = document.getElementById("patternColorInput");
  const patternColorHex = document.getElementById("patternColorHex");
  const patternDurationInput = document.getElementById("patternDurationInput");
  const patternPushBtn = document.getElementById("patternPushBtn");
  const patternPlayLocallyBtn = document.getElementById("patternPlayLocallyBtn");
  
  // Track containers
  const leftTrack = document.getElementById("leftTrack");
  const rightTrack = document.getElementById("rightTrack");
  const timeRuler = document.getElementById("timeRuler");
  const timelinePlayhead = document.getElementById("timelinePlayhead");

  // --- Initialize Sequencer Engine ---
  const sequencer = new HapticSequencer(leftTrack, rightTrack, timeRuler, timelinePlayhead);

  // Sync DAW control point adjustments
  sequencer.onCurveUpdate(() => {
    updateFrequencyGenerator();
  });

  // Sync zoom slider values dynamically based on viewport/sequence dimensions
  function syncZoomSlider() {
    const workspaceContainer = leftTrack.closest(".timeline-workspace-container");
    const containerWidth = workspaceContainer ? workspaceContainer.clientWidth - 140 : 800;
    const minPixelsPerMs = containerWidth / sequencer.totalDuration;
    
    zoomSlider.min = minPixelsPerMs;
    zoomSlider.max = Math.max(3.0, minPixelsPerMs * 4);
    zoomSlider.value = sequencer.pixelsPerMs;
  }

  // Bind zoom drag changes
  zoomSlider.addEventListener("input", () => {
    sequencer.setZoom(parseFloat(zoomSlider.value));
    zoomSlider.value = sequencer.pixelsPerMs; // sync back if clamped
    if (activeMode === "curve") {
      updateFrequencyGenerator();
    }
  });

  // Initial slider setup
  syncZoomSlider();

  // --- Populate Curve Mode Waveforms Dynamically ---
  populateCurvePresetDropdown();

  function populateCurvePresetDropdown() {
    curvePreset.innerHTML = "";

    // Group presets by category
    const categories = {};
    PRESETS.forEach(p => {
      const cat = p.category || "Other";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(p);
    });

    for (const [catName, list] of Object.entries(categories)) {
      const group = document.createElement("optgroup");
      group.label = catName;

      list.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.innerText = `${p.name} (#${p.id}) - ${p.duration}ms`;
        if (p.id === 1) opt.selected = true; // strong click by default
        group.appendChild(opt);
      });

      curvePreset.appendChild(group);
    }
  }

  // --- Populate Preset Library Side Panel ---
  const libraryEl = document.getElementById("presetsLibrary");
  renderLibrary();

  function renderLibrary() {
    libraryEl.innerHTML = "";

    // Group families by their category (Click, Bump, Buzz, Pulse, Transition, Custom)
    const categories = {};
    FAMILIES.forEach(fam => {
      const cat = fam.category || "Other";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(fam);
    });

    for (const [catName, families] of Object.entries(categories)) {
      const categorySec = document.createElement("div");
      categorySec.className = "library-category";

      const title = document.createElement("div");
      title.className = "library-category-title";
      title.innerText = catName;
      categorySec.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "presets-grid";

      families.forEach(fam => {
        const card = document.createElement("div");
        card.className = "preset-family-card";
        card.draggable = true;

        // Visual description fields
        const highestPreset = fam.members[0];
        
        card.innerHTML = `
          <div class="family-header">
            <div class="family-name">${fam.name}</div>
            <div class="family-badge">${fam.group}</div>
          </div>
          <div class="family-desc">
            ${highestPreset.duration}ms duration • ${fam.members.length} intensity variant${fam.members.length > 1 ? 's' : ''}
          </div>
        `;

        // Drag events mapping
        card.addEventListener("dragstart", (e) => {
          card.style.opacity = "0.5";
          const dragData = {
            familyName: fam.name,
            primaryPresetId: highestPreset.id // Drag and drop starts with the highest intensity member
          };
          e.dataTransfer.setData("application/json", JSON.stringify(dragData));
        });

        card.addEventListener("dragend", () => {
          card.style.opacity = "1";
        });

        // Clicking a card selects it as the active modifier preset for active node or adds it to selected track
        card.addEventListener("click", () => {
          if (sequencer.selectedNodes && sequencer.selectedNodes.size > 0) {
            // Snapshot the selection BEFORE iterating to prevent Set modification during forEach
            const snapshot = Array.from(sequencer.selectedNodes);
            // Save history ONCE before batch update
            sequencer.saveStateToHistory();
            // Batch update all selected nodes suppressing per-node selection and history callbacks
            snapshot.forEach(node => {
              sequencer.updateNodeProperties(node.id, { presetId: highestPreset.id }, false, false);
            });
            // Single re-select refresh after the entire batch completes
            sequencer.selectNodes(snapshot);
          } else if (sequencer.selectedNode) {
            sequencer.updateNodeProperties(sequencer.selectedNode.id, { presetId: highestPreset.id });
          } else {
            // If no node selected, drop onto Left Track at current playhead or 0ms
            sequencer.createNode("L", highestPreset.id, sequencer.playheadTime);
          }
        });

        grid.appendChild(card);
      });

      categorySec.appendChild(grid);
      libraryEl.appendChild(categorySec);
    }
  }

  // --- Pebble Integration Helpers ---
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function updatePebblePatternsUI() {
    pebblePatternsContainer.innerHTML = "";

    if (pebblePatterns.length === 0) {
      pebblePatternsContainer.innerHTML = `
        <div style="color: var(--text-muted); text-align: center; font-size: 11px; padding: 20px 10px; line-height: 1.4;">
          No custom patterns on device. Click '+ Add Pattern' to start!
        </div>
      `;
      return;
    }

    pebblePatterns.forEach(pattern => {
      const card = document.createElement("div");
      card.className = "pebble-pattern-card";
      card.dataset.index = pattern.index;
      if (selectedPatternIdx === pattern.index) {
        card.classList.add("active");
      }

      const hex = rgbToHex(pattern.colorR, pattern.colorG, pattern.colorB);
      card.style.setProperty("--led-color", hex);
      card.style.setProperty("--led-glow", hex + "80");

      card.innerHTML = `
        <div class="pattern-card-meta">
          <div class="pattern-card-led"></div>
          <div class="pattern-card-details">
            <span class="pattern-card-name">${pattern.name || "Untitled"}</span>
            <span class="pattern-card-duration">${(pattern.durationMs / 1000).toFixed(1)}s loop (${pattern.events.length} event${pattern.events.length !== 1 ? 's' : ''})</span>
          </div>
        </div>
        <div class="pattern-card-actions">
          <button class="pattern-card-btn delete" title="Delete Pattern">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      `;

      card.addEventListener("click", () => {
        selectPebblePattern(pattern.index);
      });

      card.querySelector(".delete").addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete the pattern "${pattern.name}" from your Pebble?`)) {
          if (selectedPatternIdx === pattern.index) {
            selectedPatternIdx = null;
            patternInspectorForm.style.display = "none";
            inspectorEmpty.style.display = "flex";
            sequencer.clear();
          }
          await deletePebblePattern(pattern.index);
        }
      });

      pebblePatternsContainer.appendChild(card);
    });
  }

  function selectPebblePattern(idx) {
    selectedPatternIdx = idx;
    const pattern = pebblePatterns[idx];
    if (!pattern) return;

    // Highlight card in list
    document.querySelectorAll(".pebble-pattern-card").forEach(card => {
      card.classList.remove("active");
      if (parseInt(card.dataset.index) === idx) {
        card.classList.add("active");
      }
    });

    // Populate metadata editor
    patternNameInput.value = pattern.name;
    const hex = rgbToHex(pattern.colorR, pattern.colorG, pattern.colorB);
    patternColorInput.value = hex;
    patternColorHex.value = hex.toUpperCase();
    patternDurationInput.value = pattern.durationMs;

    // Show pattern inspector, hide others
    inspectorEmpty.style.display = "none";
    inspectorForm.style.display = "none";
    patternInspectorForm.style.display = "block";
    patternPlayLocallyBtn.innerText = sequencer.isPlaying ? "⏸️ Pause Sequence" : "▶️ Play Sequence";

    // Load events into DAW sequencer timeline
    sequencer.selectNode(null);
    sequencer.tracks.L.nodes = [];
    sequencer.tracks.R.nodes = [];
    sequencer.setTotalDuration(pattern.durationMs);
    sequenceLengthInput.value = (pattern.durationMs / 1000).toFixed(1);

    pattern.events.forEach(ev => {
      sequencer.createNode(ev.track, ev.presetId, ev.timeMs, false);
    });

    sequencer.renderAllNodes();
    sequencer.selectNode(null);
  }

  async function pushPatternToPebble(idx, name, r, g, b, durationMs, events) {
    if (!serialManager.isConnected) return;

    try {
      // 1. Send C:WRITE command
      await serialManager.writeString(`C:WRITE:${idx}:${name}:${r}:${g}:${b}:${durationMs}:${events.length}\n`);
      await new Promise(r => setTimeout(r, 45));

      // 2. Send events
      for (const ev of events) {
        await serialManager.writeString(`C:ADD_EVENT:${idx}:${ev.timeMs}:${ev.track}:${ev.presetId}\n`);
        await new Promise(r => setTimeout(r, 30));
      }

      // 3. Send C:SAVE command
      await serialManager.writeString(`C:SAVE\n`);
      await new Promise(r => setTimeout(r, 60));

      // 4. Reload patterns list
      await serialManager.writeString(`C:READ\n`);
    } catch (err) {
      console.error("Push pattern transaction failed:", err);
      throw err;
    }
  }

  async function deletePebblePattern(idx) {
    if (!serialManager.isConnected) return;
    try {
      await serialManager.writeString(`C:DELETE:${idx}\n`);
      await new Promise(r => setTimeout(r, 80));
      await serialManager.writeString("C:READ\n");
    } catch (e) {
      console.error("Failed to delete pattern from Pebble:", e);
    }
  }

  // Handle data from serial
  function handlePebbleData(line) {
    if (line.startsWith("P:COUNT:")) {
      const count = parseInt(line.substring(8));
      tempPebblePatterns = new Array(count);
      console.log(`[Pebble Data] Expecting ${count} patterns.`);
    } else if (line.startsWith("P:INFO:")) {
      const parts = line.split(":");
      const idx = parseInt(parts[2]);
      const name = parts[3];
      const r = parseInt(parts[4]);
      const g = parseInt(parts[5]);
      const b = parseInt(parts[6]);
      const durationMs = parseInt(parts[7]);
      const eventCount = parseInt(parts[8]);

      tempPebblePatterns[idx] = {
        index: idx,
        name: name,
        colorR: r,
        colorG: g,
        colorB: b,
        durationMs: durationMs,
        eventCount: eventCount,
        events: []
      };
    } else if (line.startsWith("P:EVENT:")) {
      const parts = line.split(":");
      const idx = parseInt(parts[2]);
      const timeMs = parseInt(parts[3]);
      const track = parts[4];
      const presetId = parseInt(parts[5]);

      if (tempPebblePatterns[idx]) {
        tempPebblePatterns[idx].events.push({
          timeMs: timeMs,
          track: track,
          presetId: presetId
        });
      }
    } else if (line === "P:END") {
      pebblePatterns = tempPebblePatterns.filter(p => p !== undefined);
      console.log("[Pebble Data] Finished receiving patterns:", pebblePatterns);
      updatePebblePatternsUI();
      
      if (selectedPatternIdx !== null && selectedPatternIdx < pebblePatterns.length) {
        selectPebblePattern(selectedPatternIdx);
      } else {
        selectedPatternIdx = null;
        patternInspectorForm.style.display = "none";
        inspectorEmpty.style.display = "flex";
      }
    }
  }

  serialManager.onData(handlePebbleData);

  // Bind inspector fields
  patternColorInput.addEventListener("input", () => {
    patternColorHex.value = patternColorInput.value.toUpperCase();
    if (selectedPatternIdx !== null && pebblePatterns[selectedPatternIdx]) {
      const rgb = hexToRgb(patternColorInput.value);
      if (rgb) {
        pebblePatterns[selectedPatternIdx].colorR = rgb.r;
        pebblePatterns[selectedPatternIdx].colorG = rgb.g;
        pebblePatterns[selectedPatternIdx].colorB = rgb.b;
        updatePebblePatternsUI();
      }
    }
  });

  patternColorHex.addEventListener("input", () => {
    let val = patternColorHex.value;
    if (!val.startsWith("#")) val = "#" + val;
    if (val.length === 7 && /^#[0-9A-F]{6}$/i.test(val)) {
      patternColorInput.value = val;
      if (selectedPatternIdx !== null && pebblePatterns[selectedPatternIdx]) {
        const rgb = hexToRgb(val);
        if (rgb) {
          pebblePatterns[selectedPatternIdx].colorR = rgb.r;
          pebblePatterns[selectedPatternIdx].colorG = rgb.g;
          pebblePatterns[selectedPatternIdx].colorB = rgb.b;
          updatePebblePatternsUI();
        }
      }
    }
  });

  patternNameInput.addEventListener("input", () => {
    if (selectedPatternIdx !== null && pebblePatterns[selectedPatternIdx]) {
      pebblePatterns[selectedPatternIdx].name = patternNameInput.value.trim();
      updatePebblePatternsUI();
    }
  });

  patternDurationInput.addEventListener("change", () => {
    if (selectedPatternIdx !== null && pebblePatterns[selectedPatternIdx]) {
      const duration = parseInt(patternDurationInput.value) || 5000;
      pebblePatterns[selectedPatternIdx].durationMs = duration;
      sequencer.setTotalDuration(duration);
      sequenceLengthInput.value = (duration / 1000).toFixed(1);
      updatePebblePatternsUI();
    }
  });

  patternPlayLocallyBtn.addEventListener("click", () => {
    if (sequencer.isPlaying) {
      sequencer.stop();
      patternPlayLocallyBtn.innerText = "▶️ Play Sequence";
      playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    } else {
      sequencer.start();
      patternPlayLocallyBtn.innerText = "⏸️ Pause Sequence";
      playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
    }
  });

  patternPushBtn.addEventListener("click", async () => {
    if (selectedPatternIdx === null || !pebblePatterns[selectedPatternIdx]) return;
    
    const name = patternNameInput.value.trim() || "Untitled";
    const rgb = hexToRgb(patternColorInput.value) || { r: 255, g: 255, b: 255 };
    const duration = parseInt(patternDurationInput.value) || 5000;

    const allNodes = [...sequencer.tracks.L.nodes, ...sequencer.tracks.R.nodes];
    allNodes.sort((a, b) => a.startTime - b.startTime);
    const events = allNodes.map(n => ({
      timeMs: n.startTime,
      track: n.track,
      presetId: n.presetId
    }));

    patternPushBtn.disabled = true;
    const originalText = patternPushBtn.innerHTML;
    patternPushBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
      Syncing...
    `;

    try {
      await pushPatternToPebble(selectedPatternIdx, name, rgb.r, rgb.g, rgb.b, duration, events);
      
      patternPushBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="20 6 9 17 4 12"/></svg>
        Synced!
      `;
      patternPushBtn.style.color = "var(--color-emerald)";
      patternPushBtn.style.borderColor = "rgba(0, 255, 102, 0.25)";
      patternPushBtn.style.background = "rgba(0, 255, 102, 0.08)";

      setTimeout(() => {
        patternPushBtn.innerHTML = originalText;
        patternPushBtn.style.color = "";
        patternPushBtn.style.borderColor = "";
        patternPushBtn.style.background = "";
        patternPushBtn.disabled = false;
      }, 1500);
    } catch (err) {
      alert("Failed to push pattern to Pebble. Check connection.");
      patternPushBtn.innerHTML = originalText;
      patternPushBtn.disabled = false;
    }
  });

  pebbleAddBtn.addEventListener("click", async () => {
    if (!serialManager.isConnected) return;
    if (pebblePatterns.length >= 10) {
      alert("Pebble can store a maximum of 10 patterns.");
      return;
    }

    const newIdx = pebblePatterns.length;
    const name = `Pacer ${newIdx + 1}`;
    
    pebbleAddBtn.disabled = true;
    pebbleAddBtn.innerText = "Adding...";

    try {
      await pushPatternToPebble(newIdx, name, 255, 255, 255, 5000, []);
      selectedPatternIdx = newIdx;
    } catch (err) {
      console.error("Failed to add pattern:", err);
    } finally {
      pebbleAddBtn.disabled = false;
      pebbleAddBtn.innerText = "+ Add Pattern";
    }
  });

  pebbleResetBtn.addEventListener("click", async () => {
    if (!serialManager.isConnected) return;
    if (confirm("Restore Pebble to factory default pacing patterns? This wipes all custom patterns.")) {
      selectedPatternIdx = null;
      patternInspectorForm.style.display = "none";
      inspectorEmpty.style.display = "flex";
      sequencer.clear();
      
      try {
        await serialManager.writeString("C:RESET_DEFAULTS\n");
      } catch (err) {
        console.error("Failed to send reset defaults command:", err);
      }
    }
  });

  // Track edits to timeline to update local events list
  sequencer.onTimelineUpdate(() => {
    if (selectedPatternIdx !== null && pebblePatterns[selectedPatternIdx]) {
      const allNodes = [...sequencer.tracks.L.nodes, ...sequencer.tracks.R.nodes];
      allNodes.sort((a, b) => a.startTime - b.startTime);
      pebblePatterns[selectedPatternIdx].events = allNodes.map(n => ({
        timeMs: n.startTime,
        track: n.track,
        presetId: n.presetId
      }));
      pebblePatterns[selectedPatternIdx].durationMs = sequencer.totalDuration;
      
      updatePebblePatternsUI();
    }
  });

  // --- Web Serial Connections Logic ---
  serialManager.onStatusChange((isConnected) => {
    if (isConnected) {
      connectBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/></svg>
        Disconnect Device
      `;
      connectBtn.classList.remove("btn-primary");
      connectionStatus.className = "status-dot connected";
      syncBtn.style.display = "inline-flex";

      pebbleConnectionBadge.innerText = "Connected";
      pebbleConnectionBadge.className = "connection-badge connected";
      pebbleAddBtn.style.display = "inline-flex";
      pebbleResetBtn.style.display = "inline-flex";
      
      console.log("UI updated to connected state.");

      // Request Pebble patterns list
      setTimeout(() => {
        serialManager.writeString("C:READ\n");
      }, 500); // 500ms delay to allow device to establish connection handshake
    } else {
      connectBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        Connect Hardware
      `;
      connectBtn.classList.add("btn-primary");
      connectionStatus.className = "status-dot";
      syncBtn.style.display = "none";

      pebbleConnectionBadge.innerText = "Disconnected";
      pebbleConnectionBadge.className = "connection-badge disconnected";
      pebbleAddBtn.style.display = "none";
      pebbleResetBtn.style.display = "none";
      pebblePatterns = [];
      selectedPatternIdx = null;
      pebblePatternsContainer.innerHTML = `
        <div class="connect-prompt" style="color: var(--text-muted); text-align: center; font-size: 11.5px; padding: 20px 10px; line-height: 1.4;">
          Connect your Pebble device to manage on-device custom patterns in real-time.
        </div>
      `;
      patternInspectorForm.style.display = "none";
      inspectorEmpty.style.display = "flex";

      console.log("UI updated to disconnected state.");
    }
  });

  connectBtn.addEventListener("click", async () => {
    if (serialManager.isConnected) {
      await serialManager.disconnect();
    } else {
      await serialManager.connect();
    }
  });

  // Sync timeline patterns offline to Pebble hardware
  syncBtn.addEventListener("click", async () => {
    if (!serialManager.isConnected) {
      alert("Pebble device is not connected.");
      return;
    }
    if (selectedPatternIdx === null) {
      alert("Please select a pattern from the 'Pebble Patterns' list on the left to sync.");
      return;
    }
    patternPushBtn.click();
  });

  // --- Playback Actions ---
  playBtn.addEventListener("click", () => {
    if (sequencer.isPlaying) {
      sequencer.stop();
      playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    } else {
      sequencer.start();
      playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
    }
  });

  stopBtn.addEventListener("click", () => {
    sequencer.stop();
    playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  });

  loopBtn.addEventListener("click", () => {
    sequencer.isLooping = !sequencer.isLooping;
    if (sequencer.isLooping) {
      loopBtn.classList.add("loop-active");
    } else {
      loopBtn.classList.remove("loop-active");
    }
  });

  // Handle timeline length modification
  sequenceLengthInput.addEventListener("change", () => {
    const seconds = parseFloat(sequenceLengthInput.value);
    sequencer.setTotalDuration(seconds * 1000);
    // Sync input field to snapped duration (divided by 1000)
    sequenceLengthInput.value = (sequencer.totalDuration / 1000).toFixed(1);
    syncZoomSlider();
    if (activeMode === "curve") {
      updateFrequencyGenerator();
    }
  });

  // Handle snapping resolution changes
  const snapResolutionInput = document.getElementById("snapResolution");
  snapResolutionInput.addEventListener("change", () => {
    sequencer.setSnapResolution(parseInt(snapResolutionInput.value));
    if (activeMode === "curve") {
      updateFrequencyGenerator();
    }
  });

  // --- Clear Sequence Action ---
  clearBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear the entire sequence grid?")) {
      sequencer.clear();
      if (activeMode === "curve") {
        switchToManualMode();
      }
    }
  });



  // --- Mode Switcher Logic ---
  function switchToManualMode() {
    activeMode = "manual";
    sequencer.mode = "manual";
    
    // Style tabs
    modeManualBtn.style.background = "";
    modeManualBtn.style.color = "";
    modeManualBtn.classList.add("btn-primary");
    
    modeCurveBtn.classList.remove("btn-primary");
    modeCurveBtn.style.background = "transparent";
    modeCurveBtn.style.border = "none";
    modeCurveBtn.style.color = "var(--text-secondary)";
    
    leftPanelHeader.innerText = "Preset Library";
    presetsLibrary.style.display = "block";
    generatorSidebar.style.display = "none";
    
    // Hide curve SVG projection and block pointer events
    rulerCurveSvg.style.opacity = "0";
    rulerCurveSvg.style.pointerEvents = "none";
  }

  function switchToCurveMode() {
    activeMode = "curve";
    sequencer.mode = "curve";
    
    // Style tabs
    modeCurveBtn.style.background = "";
    modeCurveBtn.style.color = "";
    modeCurveBtn.classList.add("btn-primary");
    
    modeManualBtn.classList.remove("btn-primary");
    modeManualBtn.style.background = "transparent";
    modeManualBtn.style.border = "none";
    modeManualBtn.style.color = "var(--text-secondary)";
    
    leftPanelHeader.innerText = "Curve Generator";
    presetsLibrary.style.display = "none";
    generatorSidebar.style.display = "flex";
    
    // Show curve SVG projection
    rulerCurveSvg.style.opacity = "1";
    
    // Regenerate and plot
    updateFrequencyGenerator();
  }

  modeManualBtn.addEventListener("click", () => {
    switchToManualMode();
  });

  modeCurveBtn.addEventListener("click", () => {
    switchToCurveMode();
  });

  // --- Frequency Mode Generator Controllers ---
  function updateFrequencyGenerator(e) {
    if (activeMode !== "curve") return;
    
    // Reset breathPreset selection if user edits sliders manually
    if (e && e.target && e.target.id !== "breathPreset" && e.target.id !== "curvePreset" && e.target.id !== "curveDynamicIntensity") {
      breathPreset.value = "custom";
    }

    const shape = curveShape.value;
    const baseInterval = parseInt(curveBaseInterval.value) || 1200;
    const peakInterval = parseInt(curvePeakInterval.value) || 200;
    const crestPosition = parseFloat(curveCrestPosition.value) || 0.4;
    const routing = curveRouting.value;
    const presetId = parseInt(curvePreset.value) || 1;
    const dynamicIntensity = curveDynamicIntensity.checked;

    // Toggle interactive ruler clicks for DAW canvas
    if (shape === "custom") {
      rulerCurveSvg.style.pointerEvents = "auto";
    } else {
      rulerCurveSvg.style.pointerEvents = "none";
    }

    // Synchronize slider output label
    crestPosDisplay.innerText = `${Math.round(crestPosition * 100)}%`;

    const params = { shape, baseInterval, peakInterval, crestPosition, routing, presetId, dynamicIntensity };
    
    sequencer.generateFrequencySequence(params);
    sequencer.drawCurveVisualization(params);
    
    // Draw the active trigger waveform profile inside the sidebar canvas
    drawWaveformProfile(presetId, "generatorWaveformCanvas");
  }

  // Bind generator controls
  [curveShape, curveRouting, curvePreset, curveDynamicIntensity].forEach(el => {
    el.addEventListener("change", updateFrequencyGenerator);
  });
  
  [curveBaseInterval, curvePeakInterval, curveCrestPosition].forEach(el => {
    el.addEventListener("input", updateFrequencyGenerator);
    el.addEventListener("change", updateFrequencyGenerator);
  });

  // Biological breath presets listener
  breathPreset.addEventListener("change", () => {
    const p = breathPreset.value;
    if (p === "custom") return;
    
    if (p === "relax") {
      // 10s (4s inhale / 6s exhale)
      sequenceLengthInput.value = "10.0";
      sequencer.setTotalDuration(10000);
      curveShape.value = "gaussian";
      curveBaseInterval.value = "1600";
      curvePeakInterval.value = "250";
      curveCrestPosition.value = "0.4"; // peak at 40% (4s)
      curveRouting.value = "alternate";
      curvePreset.value = "119"; // Smooth Hum 1 (50%)
    } else if (p === "box") {
      // 16s Box (4s inhale, 4s hold, 4s exhale, 4s hold)
      sequenceLengthInput.value = "16.0";
      sequencer.setTotalDuration(16000);
      curveShape.value = "gaussian";
      curveBaseInterval.value = "2000";
      curvePeakInterval.value = "300";
      curveCrestPosition.value = "0.3";
      curveRouting.value = "both";
      curvePreset.value = "7"; // Soft Bump (100%)
    } else if (p === "energize") {
      // 4s Energize (2s inhale / 2s exhale)
      sequenceLengthInput.value = "4.0";
      sequencer.setTotalDuration(4000);
      curveShape.value = "sine";
      curveBaseInterval.value = "600";
      curvePeakInterval.value = "120";
      curveCrestPosition.value = "0.5";
      curveRouting.value = "both";
      curvePreset.value = "4"; // Sharp Click (100%)
    } else if (p === "calm") {
      // Decelerating heartbeat pacing (8s)
      sequenceLengthInput.value = "8.0";
      sequencer.setTotalDuration(8000);
      curveShape.value = "linear";
      curveBaseInterval.value = "2000";
      curvePeakInterval.value = "300";
      curveCrestPosition.value = "0.1"; // crest near the start, then slows down
      curveRouting.value = "alternate";
      curvePreset.value = "24"; // Sharp Tick 1 (100%)
    }
    
    syncZoomSlider();
    updateFrequencyGenerator();
  });

  // --- File Load & Exports ---
  exportBtn.addEventListener("click", () => {
    const json = sequencer.exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `pebble_sequence_${sequencer.totalDuration}ms.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const success = sequencer.importJSON(event.target.result);
      if (success) {
        sequenceLengthInput.value = (sequencer.totalDuration / 1000).toFixed(1);
        syncZoomSlider();
      }
    };
    reader.readAsText(file);
    // Reset file input value so same file can be imported again if edited
    fileInput.value = "";
  });

  sequencer.onSelectionChange((node, selectedList) => {
    const list = selectedList || (node ? [node] : []);

    if (list.length === 0) {
      if (selectedPatternIdx !== null) {
        inspectorEmpty.style.display = "none";
        inspectorForm.style.display = "none";
        patternInspectorForm.style.display = "block";
      } else {
        inspectorEmpty.style.display = "flex";
        inspectorForm.style.display = "none";
        patternInspectorForm.style.display = "none";
      }
      return;
    }

    patternInspectorForm.style.display = "none";
    inspectorEmpty.style.display = "none";
    inspectorForm.style.display = "block";

    if (list.length > 1) {
      // Show multi-selection mode
      const firstTrack = list[0].track;
      const allSameTrack = list.every(n => n.track === firstTrack);
      const activeActuatorClass = (allSameTrack && firstTrack === "R") ? "right-actuator-active" : "left-actuator-active";
      
      inspectorForm.className = `inspector-form multi-selection-active ${activeActuatorClass}`;
      nodePresetFamily.innerText = `${list.length} Blocks Selected`;
      nodePresetMeta.innerText = "Batch editing active";
      
      // Hide start time (doesn't apply to multi-selection)
      inspectStartTime.closest(".form-group").style.display = "none";
      
      // Show track selection, checking if they are all on L, R, or split
      inspectTrack.value = allSameTrack ? firstTrack : "";
      
      // Check if all selected nodes share the same mother preset family
      const firstFamily = list[0].family;
      const allSameFamily = list.every(n => n.family === firstFamily);
      
      if (allSameFamily) {
        // Render variant intensity tiers for the family group
        intensityTiersGrid.innerHTML = "";
        const matchedFamily = FAMILIES.find(f => f.name === firstFamily);
        
        if (matchedFamily && matchedFamily.members.length > 1) {
          intensitySection.style.display = "flex";
          
          // Determine if all selected nodes have the exact same intensity/presetId
          const firstPresetId = list[0].presetId;
          const allSamePresetId = list.every(n => n.presetId === firstPresetId);
          
          matchedFamily.members.forEach(member => {
            const btn = document.createElement("button");
            btn.className = "intensity-btn";
            if (allSamePresetId && member.id === firstPresetId) {
              btn.classList.add("active");
            }
            
            // Output label as relative power
            btn.innerText = `${Math.round(member.intensity * 100)}%`;
            
            btn.addEventListener("click", () => {
              // Snapshot before iterating to prevent mutating the selected nodes Set
              const snapshot = Array.from(sequencer.selectedNodes);
              // Save history ONCE before batch update
              sequencer.saveStateToHistory();
              snapshot.forEach(n => {
                sequencer.updateNodeProperties(n.id, { presetId: member.id }, false, false);
              });
              
              // Single refresh call after batch updates
              sequencer.selectNodes(snapshot);
              
              // Trigger test tactile pulse on the first block of selection
              if (snapshot.length > 0) {
                sequencer.triggerHardware(snapshot[0]);
              }
            });
            
            intensityTiersGrid.appendChild(btn);
          });
        } else {
          intensitySection.style.display = "none";
        }
      } else {
        // Different families selected - hide intensity options
        intensitySection.style.display = "none";
      }
      
      // Draw "Multi-Selection Active" message on waveform canvas
      const canvas = document.getElementById("waveformCanvas");
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#0c0d12";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Multi-selection active", canvas.width / 2, canvas.height / 2 + 4);
      }
    } else {
      // Single selection mode
      inspectStartTime.closest(".form-group").style.display = "flex";
      
      inspectorForm.className = `inspector-form ${node.track === 'L' ? 'left-actuator-active' : 'right-actuator-active'}`;

      nodePresetFamily.innerText = node.family;
      nodePresetMeta.innerText = `TI DRV2605 preset index: ${node.presetId} (${node.duration}ms)`;
      
      inspectStartTime.value = node.startTime;
      inspectTrack.value = node.track;

      // Render Canvas Profile Waveform!
      drawWaveformProfile(node.presetId);

      // Render Variant Intensity Tiers button list!
      intensityTiersGrid.innerHTML = "";

      // Find all presets in the same family group
      const matchedFamily = FAMILIES.find(f => f.name === node.family);
      if (matchedFamily && matchedFamily.members.length > 1) {
        intensitySection.style.display = "flex";

        matchedFamily.members.forEach(member => {
          const btn = document.createElement("button");
          btn.className = "intensity-btn";
          if (member.id === node.presetId) {
            btn.classList.add("active");
          }

          // Output label as relative power
          btn.innerText = `${Math.round(member.intensity * 100)}%`;
          
          btn.addEventListener("click", () => {
            sequencer.updateNodeProperties(node.id, { presetId: member.id });
            // Live test trigger immediately so user physically feels the intensity shift!
            sequencer.triggerHardware(node);
            // Redraw waveform visual profile!
            drawWaveformProfile(member.id);
          });

          intensityTiersGrid.appendChild(btn);
        });
      } else {
        // Hide intensity panel if preset family does not support multi-intensity steps
        intensitySection.style.display = "none";
      }
    }
  });

  // Pacing timing inputs changes
  inspectStartTime.addEventListener("change", () => {
    if (sequencer.selectedNode) {
      const val = parseInt(inspectStartTime.value);
      sequencer.updateNodeProperties(sequencer.selectedNode.id, { startTime: val });
      inspectStartTime.value = sequencer.selectedNode.startTime; // sync back snapped values
    }
  });

  // Driver output track changes
  inspectTrack.addEventListener("change", () => {
    if (sequencer.selectedNodes && sequencer.selectedNodes.size > 0) {
      // Snapshot before iteration to prevent Set modification during forEach
      const snapshot = Array.from(sequencer.selectedNodes);
      // Save history ONCE before batch update
      sequencer.saveStateToHistory();
      snapshot.forEach(node => {
        sequencer.updateNodeProperties(node.id, { track: inspectTrack.value }, false, false);
      });
      // Single re-select refresh after batch completes
      sequencer.selectNodes(snapshot);
    } else if (sequencer.selectedNode) {
      sequencer.updateNodeProperties(sequencer.selectedNode.id, { track: inspectTrack.value });
    }
  });

  // Test play node instantly
  inspectTestBtn.addEventListener("click", () => {
    if (sequencer.selectedNode) {
      sequencer.triggerHardware(sequencer.selectedNode);
    }
  });

  // Delete node block - snapshot first to avoid iterating a Set being mutated
  inspectDeleteBtn.addEventListener("click", () => {
    if (sequencer.selectedNodes && sequencer.selectedNodes.size > 0) {
      const ids = Array.from(sequencer.selectedNodes).map(n => n.id);
      sequencer.deleteNodes(ids);
    } else if (sequencer.selectedNode) {
      sequencer.deleteNode(sequencer.selectedNode.id);
    }
  });

  // Close inspector when clicking outer timeline body area
  document.querySelector(".timeline-grid-wrapper").addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("timeline-grid-wrapper") || e.target.id === "timeRuler" || e.target.id === "rulerContent") {
      sequencer.selectNode(null);
    }
  });

  // Global keyboard listener to delete, copy, and paste selected node blocks
  document.addEventListener("keydown", (e) => {
    // If typing in input fields, ignore keypresses to avoid deleting/modifying blocks accidentally
    if (
      e.target.tagName === "INPUT" ||
      e.target.tagName === "SELECT" ||
      e.target.tagName === "TEXTAREA" ||
      e.target.isContentEditable
    ) {
      return;
    }

    // Cmd+Z / Ctrl+Z -> Undo
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      sequencer.undo();
    }

    // Cmd+Shift+Z / Cmd+Y / Ctrl+Y -> Redo
    if (
      ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") ||
      ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "z")
    ) {
      e.preventDefault();
      sequencer.redo();
    }

    // Cmd+C / Ctrl+C -> Copy
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      sequencer.copyNodes();
    }

    // Cmd+V / Ctrl+V -> Paste
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
      e.preventDefault();
      
      // Determine track target: primary is hovered track, fallback to selected node's track, then default to track "L"
      const targetTrack = sequencer.hoveredTrack || (sequencer.selectedNode ? sequencer.selectedNode.track : "L");
      
      // Determine time target: primary is hovered snapped time, fallback to current playhead time
      const targetTime = sequencer.hoveredTimeMs !== null ? sequencer.hoveredTimeMs : sequencer.playheadTime;
      
      sequencer.pasteNodes(targetTrack, targetTime);
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      if (sequencer.selectedNodes && sequencer.selectedNodes.size > 0) {
        e.preventDefault();
        // Snapshot before deleteNodes clears the set
        const ids = Array.from(sequencer.selectedNodes).map(n => n.id);
        sequencer.deleteNodes(ids);
      } else if (sequencer.selectedNode) {
        e.preventDefault();
        sequencer.deleteNode(sequencer.selectedNode.id);
      }
    }
  });

  // --- Preload Immersive Demo Heartbeat Sequence ---
  preloadDemoSequence();

  function preloadDemoSequence() {
    console.log("Loading immersive heartbeat demo sequence...");
    // A standard 1.0 second heartbeat sequence:
    // Left Channel (Index LRA): Clicks at 100ms and 500ms
    // Right Channel (Thumb LRA): Soft echo bumps at 200ms and 600ms
    
    // Index Clicks (Strong Click family 1->3)
    sequencer.createNode("L", 1, 100);  // Strong Click 100%
    sequencer.createNode("L", 2, 500);  // Strong Click 60%

    // Thumb Echoes (Soft Bump family 24->26)
    sequencer.createNode("R", 24, 200); // Soft Bump 100%
    sequencer.createNode("R", 26, 600); // Soft Bump 30%

    // Deselect selection on start
    sequencer.selectNode(null);
  }

  // Adjust timing grid mapping triggers on page resize
  window.addEventListener("resize", () => {
    sequencer.setTotalDuration(sequencer.totalDuration);
    syncZoomSlider();
    if (activeMode === "curve") {
      updateFrequencyGenerator();
    }
  });  // --- Waveform Visualizer Canvas Renderer ---
  function drawWaveformProfile(presetId, canvasId = "waveformCanvas") {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    
    ctx.fillStyle = "#0c0d12";
    ctx.fillRect(0, 0, W, H);
    
    // Horizontal center zero-amplitude line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, H/2);
    ctx.lineTo(W, H/2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    
    const cat = preset.category || "Clicks";
    const isLeft = (canvasId === "generatorWaveformCanvas") || (sequencer.selectedNode && sequencer.selectedNode.track === "L");
    ctx.strokeStyle = isLeft ? "#e5a93b" : "#569890";
    ctx.shadowColor = isLeft ? "rgba(229, 169, 59, 0.4)" : "rgba(86, 152, 144, 0.35)";
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    ctx.beginPath();
    
    const pad = 20;
    const drawW = W - pad * 2;
    const midY = H / 2;
    
    // Scale width based on actual duration (max duration is 1200ms in catalog)
    const maxDuration = 1200; // ms
    const waveWidth = Math.max(10, Math.min(drawW, (preset.duration / maxDuration) * drawW));
    const endX = pad + waveWidth;
    
    // Scale amplitude based on actual intensity (0.1 to 1.0)
    const intensity = preset.intensity || 1.0;
    const maxAmp = intensity * 24; // max peak vertical amplitude
    
    if (cat.includes("Clicks") || cat.includes("Click")) {
      // Rapid spike + exponential decay within its waveWidth
      ctx.moveTo(pad, midY);
      const spikeX = pad + Math.min(10, waveWidth * 0.15);
      ctx.lineTo(spikeX, midY - maxAmp);
      ctx.lineTo(spikeX + Math.min(5, waveWidth * 0.1), midY + maxAmp * 0.5);
      
      const startDecayX = spikeX + Math.min(5, waveWidth * 0.1);
      for (let x = startDecayX; x <= endX; x++) {
        const t = (x - startDecayX) / (waveWidth * 0.7);
        const amp = Math.exp(-t * 5) * Math.sin(t * 15) * maxAmp * 0.5;
        ctx.lineTo(x, midY + amp);
      }
      ctx.lineTo(endX, midY);
    } else if (cat.includes("Bumps") || cat.includes("Bump")) {
      // Smooth sine lobe ending at endX
      ctx.moveTo(pad, midY);
      for (let x = pad; x <= endX; x++) {
        const pct = (x - pad) / waveWidth;
        const amp = Math.sin(pct * Math.PI) * maxAmp;
        ctx.lineTo(x, midY - amp);
      }
      ctx.lineTo(endX, midY);
    } else if (cat.includes("Buzz") || cat.includes("Fuzz")) {
      ctx.moveTo(pad, midY);
      for (let x = pad; x <= endX; x++) {
        const pct = (x - pad) / waveWidth;
        const env = Math.sin(pct * Math.PI) * maxAmp;
        const osc = Math.sin(pct * 40) * env;
        ctx.lineTo(x, midY - osc);
      }
      ctx.lineTo(endX, midY);
    } else if (cat.includes("Pulses") || cat.includes("Pulser")) {
      ctx.moveTo(pad, midY);
      for (let x = pad; x <= endX; x++) {
        const pct = (x - pad) / waveWidth;
        const env = Math.sin(pct * Math.PI);
        const osc = Math.sin(pct * 25) * env * maxAmp;
        ctx.lineTo(x, midY - osc);
      }
      ctx.lineTo(endX, midY);
    } else if (cat.includes("Alerts") || cat.includes("Alert")) {
      ctx.moveTo(pad, midY);
      for (let x = pad; x <= endX; x++) {
        const pct = (x - pad) / waveWidth;
        const env = Math.sin(pct * Math.PI);
        const sq = Math.sign(Math.sin(pct * 24)) * env * maxAmp * 0.8;
        ctx.lineTo(x, midY - sq);
      }
      ctx.lineTo(endX, midY);
    } else if (cat.includes("Sweeps") || cat.includes("Sweep")) {
      const isUp = preset.name.includes("Ramp Up");
      ctx.moveTo(pad, midY);
      for (let x = pad; x <= endX; x++) {
        const pct = (x - pad) / waveWidth;
        const ramp = isUp ? pct : (1.0 - pct);
        const osc = Math.sin(pct * 40) * ramp * maxAmp;
        ctx.lineTo(x, midY - osc);
      }
      ctx.lineTo(endX, midY);
    } else {
      // Smooth Hum (continuous soft wave)
      ctx.moveTo(pad, midY);
      for (let x = pad; x <= endX; x++) {
        const pct = (x - pad) / waveWidth;
        const env = Math.sin(pct * Math.PI) * maxAmp;
        const osc = Math.sin(pct * 30) * env;
        ctx.lineTo(x, midY - osc);
      }
      ctx.lineTo(endX, midY);
    }
    
    // Draw horizontal zero-line connection past endX to show quiet resting period
    if (endX < W - pad) {
      ctx.lineTo(W - pad, midY);
    }
    
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "9.5px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${preset.duration}ms Profile`, W - 10, H - 8);
    ctx.textAlign = "left";
    ctx.fillText(`Power: ${Math.round(preset.intensity * 100)}%`, 10, H - 8);
  }

  // --- DAW Live Keyboard Recorder ---
  recordBtn.addEventListener("click", () => {
    isRecording = !isRecording;
    if (isRecording) {
      recordBtn.classList.add("record-active");
      console.log("Live Keyboard Recording armed.");
    } else {
      recordBtn.classList.remove("record-active");
      console.log("Live Keyboard Recording disarmed.");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!isRecording) return;
    
    // Ignore keydown if focused inside writing forms
    if (
      e.target.tagName === "INPUT" ||
      e.target.tagName === "SELECT" ||
      e.target.tagName === "TEXTAREA" ||
      e.target.isContentEditable
    ) {
      return;
    }

    const key = e.code;
    let trackId = null;
    if (key === "KeyA" || key === "ArrowLeft") {
      trackId = "L";
    } else if (key === "KeyD" || key === "ArrowRight") {
      trackId = "R";
    }

    if (trackId) {
      e.preventDefault();
      
      const activePresetId = sequencer.selectedNode ? sequencer.selectedNode.presetId : (curvePreset.value ? parseInt(curvePreset.value) : 1);
      const playheadTime = sequencer.playheadTime;
      
      const placedNode = sequencer.createNode(trackId, activePresetId, playheadTime);
      if (placedNode) {
        sequencer.triggerHardware(placedNode);
      }
    }
  });

  // --- Persistent Local Database Vault ---
  updateVaultList();

  saveToDbBtn.addEventListener("click", () => {
    const name = prompt("Enter a name for your custom sequence:");
    if (!name) return;
    
    const key = "haptic_seq_" + name.trim();
    if (localStorage.getItem(key)) {
      if (!confirm(`A sequence named "${name}" already exists. Overwrite?`)) {
        return;
      }
    }
    
    const json = sequencer.exportJSON();
    localStorage.setItem(key, json);
    updateVaultList();
  });

  function updateVaultList() {
    savedSequencesList.innerHTML = "";
    
    let hasKeys = false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("haptic_seq_")) {
        hasKeys = true;
        const name = key.replace("haptic_seq_", "");
        const rawData = localStorage.getItem(key);
        let durationTag = "1.0s";
        try {
          const parsed = JSON.parse(rawData);
          durationTag = ((parsed.totalDuration || 1000) / 1000).toFixed(1) + "s";
        } catch (e) {}

        const item = document.createElement("div");
        item.className = "vault-item";
        
        item.innerHTML = `
          <div class="vault-info">
            <span class="vault-title">${name}</span>
            <span class="vault-meta">${durationTag} duration</span>
          </div>
          <div class="vault-actions">
            <button class="vault-item-btn load" title="Load Sequence">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            </button>
            <button class="vault-item-btn delete" title="Delete Sequence">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        `;
        
        item.querySelector(".load").addEventListener("click", (e) => {
          e.stopPropagation();
          const success = sequencer.importJSON(rawData);
          if (success) {
            sequenceLengthInput.value = (sequencer.totalDuration / 1000).toFixed(1);
            syncZoomSlider();
            if (activeMode === "curve") {
              updateFrequencyGenerator();
            }
          }
        });

        item.querySelector(".delete").addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm(`Are you sure you want to delete "${name}" from your vault?`)) {
            localStorage.removeItem(key);
            updateVaultList();
          }
        });

        item.addEventListener("click", () => {
          const success = sequencer.importJSON(rawData);
          if (success) {
            sequenceLengthInput.value = (sequencer.totalDuration / 1000).toFixed(1);
            syncZoomSlider();
            if (activeMode === "curve") {
              updateFrequencyGenerator();
            }
          }
        });

        savedSequencesList.appendChild(item);
      }
    }

    if (!hasKeys) {
      savedSequencesList.innerHTML = `<div style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 10px 0;">Vault is empty. Save a sequence to register it!</div>`;
    }
  }
});
