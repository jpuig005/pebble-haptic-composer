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
      console.log("UI updated to connected state.");
    } else {
      connectBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        Connect Hardware
      `;
      connectBtn.classList.add("btn-primary");
      connectionStatus.className = "status-dot";
      syncBtn.style.display = "none";
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

    const allNodes = [...sequencer.tracks.L.nodes, ...sequencer.tracks.R.nodes];
    
    // Sort chronologically by time to play back linearly
    allNodes.sort((a, b) => a.startTime - b.startTime);

    // Disable sync button and show loading spinner animation
    syncBtn.disabled = true;
    const originalHtml = syncBtn.innerHTML;
    syncBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
      Syncing...
    `;

    try {
      // 1. CLEAR command to wipe load buffer
      await serialManager.writeString("C:CLEAR\n");
      await new Promise(r => setTimeout(r, 20)); // Brief pacing delay

      // 2. Set DURATION command
      await serialManager.writeString(`C:DUR:${sequencer.totalDuration}\n`);
      await new Promise(r => setTimeout(r, 20));

      // 3. Stream ADD haptic events
      for (const node of allNodes) {
        const track = node.track;
        const time = node.startTime;
        const presetId = node.presetId;

        await serialManager.writeString(`C:ADD:${time}:${track}:${presetId}\n`);
        await new Promise(r => setTimeout(r, 15)); // Pacing delay to prevent ESP32 buffer overflows
      }

      // 4. Send SAVE command
      await serialManager.writeString("C:SAVE\n");
      await new Promise(r => setTimeout(r, 20));

      // Successful sync visual feedback
      syncBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="20 6 9 17 4 12"/></svg>
        Synced!
      `;
      syncBtn.style.color = "var(--color-emerald)";
      syncBtn.style.borderColor = "rgba(0, 255, 102, 0.25)";
      syncBtn.style.background = "rgba(0, 255, 102, 0.08)";

      setTimeout(() => {
        syncBtn.innerHTML = originalHtml;
        syncBtn.style.color = "var(--color-cyan)";
        syncBtn.style.borderColor = "rgba(0, 240, 255, 0.25)";
        syncBtn.style.background = "rgba(0, 240, 255, 0.08)";
        syncBtn.disabled = false;
      }, 2000);

    } catch (err) {
      console.error("Pattern sync failed:", err);
      alert("Failed to sync pattern. Check serial connection.");
      syncBtn.innerHTML = originalHtml;
      syncBtn.disabled = false;
    }
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

  // --- Sequencer Inspector Interactivity ---
  sequencer.onSelectionChange((node, selectedList) => {
    const list = selectedList || (node ? [node] : []);

    if (list.length === 0) {
      // Hide Inspector form, show empty slate
      inspectorEmpty.style.display = "flex";
      inspectorForm.style.display = "none";
      return;
    }

    // Populate standard inspector values
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
