/**
 * sequencer.js
 * Visual timeline sequencer logic. Manages haptic node scheduling, snapping grid calculations,
 * and high-precision animation playhead clocks with trigger interval checks.
 */

import { serialManager } from "./serial.js";
import { PRESETS } from "./presets.js";

export class HapticSequencer {
  constructor(leftTrackElement, rightTrackElement, rulerElement, playheadElement) {
    this.tracks = {
      L: { el: leftTrackElement, nodes: [] },
      R: { el: rightTrackElement, nodes: [] }
    };
    this.rulerEl = rulerElement;
    this.rulerContentEl = rulerElement.querySelector(".ruler-content") || rulerElement;
    this.playheadEl = playheadElement;

    // Timeline Configuration
    this.totalDuration = 1000; // ms
    this.snapResolution = 100; // ms
    this.pixelsPerMs = 0.8; // Timeline zoom mapping (px/ms)

    // Playback State
    this.isPlaying = false;
    this.isLooping = true;
    this.playheadTime = 0; // Current progress in ms
    this.lastFrameTime = 0; // Timestamp of previous requestAnimationFrame
    this.animationFrameId = null;

    // Selection State
    this.selectedNode = null;
    this.selectedNodes = new Set();
    this.clipboardNodes = []; // Clipboard buffer for haptic block copying
    this.hoveredTrack = null; // Track index L/R currently hovered by mouse cursor
    this.hoveredTimeMs = null; // Snapped time currently hovered by mouse cursor
    
    // History stacks
    this.undoStack = [];
    this.redoStack = [];
    
    this.onSelectionChangeCallback = null;
    this.onTimelineUpdateCallback = null;
    this.onPlayheadMoveCallback = null;

    this.mode = "manual"; // Modes: 'manual' or 'curve'

    // DAW-Style Control Points (Normalized x: 0-1, y: 0-1)
    this.controlPoints = [
      { x: 0.0, y: 0.2 },
      { x: 0.4, y: 0.8 },
      { x: 1.0, y: 0.2 }
    ];
    this.onCurveUpdateCallback = null;

    this.initEventListeners();
    this.renderRuler();
    this.initDAWCurveEvents();
  }

  // --- External Event Hooks ---
  onSelectionChange(callback) {
    this.onSelectionChangeCallback = callback;
  }

  onTimelineUpdate(callback) {
    this.onTimelineUpdateCallback = callback;
  }

  onPlayheadMove(callback) {
    this.onPlayheadMoveCallback = callback;
  }

  onCurveUpdate(callback) {
    this.onCurveUpdateCallback = callback;
  }

  // --- DAW Canvas Interactive Curve Events ---
  initDAWCurveEvents() {
    const svgEl = document.getElementById("rulerCurveSvg");
    if (!svgEl) return;

    svgEl.addEventListener("dblclick", (e) => {
      if (this.mode !== "curve") return;
      
      const curveShape = document.getElementById("curveShape");
      if (curveShape.value !== "custom") return;

      const rect = svgEl.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const xRatio = Math.max(0.01, Math.min(0.99, clickX / rect.width));
      const yRatio = Math.max(0.0, Math.min(1.0, (30 - clickY) / 24));

      this.addControlPoint(xRatio, yRatio);
    });
  }

  addControlPoint(x, y) {
    this.controlPoints.push({ x, y });
    this.controlPoints.sort((a, b) => a.x - b.x);
    this.renderControlPoints();
    
    if (this.onCurveUpdateCallback) this.onCurveUpdateCallback();
  }

  deleteControlPoint(idx) {
    if (idx === 0 || idx === this.controlPoints.length - 1) return;
    
    this.controlPoints.splice(idx, 1);
    this.renderControlPoints();
    
    if (this.onCurveUpdateCallback) this.onCurveUpdateCallback();
  }

  renderControlPoints() {
    const pointsGroup = document.getElementById("rulerCurvePoints");
    if (!pointsGroup) return;
    
    pointsGroup.innerHTML = "";
    
    const svgEl = document.getElementById("rulerCurveSvg");
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const width = rect.width || this.msToPx(this.totalDuration);
    
    const curveShape = document.getElementById("curveShape");
    if (this.mode !== "curve" || (curveShape && curveShape.value !== "custom")) {
      return;
    }

    this.controlPoints.forEach((pt, idx) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", pt.x * width);
      circle.setAttribute("cy", 30 - 24 * pt.y);
      circle.setAttribute("r", 5);
      circle.setAttribute("class", "curve-point-handle" + (idx === 0 || idx === this.controlPoints.length - 1 ? " locked-x" : ""));
      
      circle.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        const isLockedX = (idx === 0 || idx === this.controlPoints.length - 1);
        
        const onMouseMove = (moveEvent) => {
          const moveRect = svgEl.getBoundingClientRect();
          const curX = moveEvent.clientX - moveRect.left;
          const curY = moveEvent.clientY - moveRect.top;
          
          pt.y = Math.max(0.0, Math.min(1.0, (30 - curY) / 24));
          
          if (!isLockedX) {
            const prevPt = this.controlPoints[idx - 1];
            const nextPt = this.controlPoints[idx + 1];
            const minX = prevPt ? prevPt.x + 0.01 : 0.01;
            const maxX = nextPt ? nextPt.x - 0.01 : 0.99;
            
            pt.x = Math.max(minX, Math.min(maxX, curX / moveRect.width));
          }
          
          circle.setAttribute("cx", pt.x * moveRect.width);
          circle.setAttribute("cy", 30 - 24 * pt.y);
          
          if (this.onCurveUpdateCallback) this.onCurveUpdateCallback();
        };
        
        const onMouseUp = () => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        };
        
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
      
      circle.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        this.deleteControlPoint(idx);
      });

      pointsGroup.appendChild(circle);
    });
  }

  // --- Timing Calculations ---
  msToPx(ms) {
    return ms * this.pixelsPerMs;
  }

  pxToMs(px) {
    return px / this.pixelsPerMs;
  }

  snapMs(ms) {
    return Math.max(0, Math.min(
      Math.round(ms / this.snapResolution) * this.snapResolution,
      this.totalDuration - this.snapResolution
    ));
  }

  // --- State Modification Methods ---
  setTotalDuration(newDuration) {
    const oldDuration = this.totalDuration;
    this.totalDuration = Math.max(200, Math.round(newDuration / 100) * 100);
    
    // Ensure the timeline spans at least the visible container width so there is no blank space on the right
    const workspaceContainer = this.tracks.L.el.closest(".timeline-workspace-container");
    const containerWidth = workspaceContainer ? workspaceContainer.clientWidth - 140 : 800;
    const minPixelsPerMs = containerWidth / this.totalDuration;
    if (this.pixelsPerMs < minPixelsPerMs) {
      this.pixelsPerMs = minPixelsPerMs;
    }

    // Clamp existing nodes that exceed the new duration boundary
    for (const trackId of ["L", "R"]) {
      this.tracks[trackId].nodes = this.tracks[trackId].nodes.filter(node => {
        if (node.startTime >= this.totalDuration) {
          if (this.selectedNode === node) this.selectNode(null);
          return false;
        }
        return true;
      });
    }

    this.renderRuler();
    this.renderAllNodes();
    
    if (this.playheadTime > this.totalDuration) {
      this.setPlayheadTime(0);
    } else {
      this.updatePlayheadVisual();
    }

    if (this.onTimelineUpdateCallback) this.onTimelineUpdateCallback();
  }

  setZoom(newPixelsPerMs) {
    const workspaceContainer = this.tracks.L.el.closest(".timeline-workspace-container");
    const containerWidth = workspaceContainer ? workspaceContainer.clientWidth - 140 : 800;
    const minPixelsPerMs = containerWidth / this.totalDuration;
    
    // Clamp zoom so it doesn't get smaller than what's needed to fill the visible container width
    this.pixelsPerMs = Math.max(minPixelsPerMs, Math.min(newPixelsPerMs, 3.0));
    
    this.renderRuler();
    this.renderAllNodes();
    this.updatePlayheadVisual();
  }

  setSnapResolution(resolutionMs) {
    this.snapResolution = Math.max(1, parseInt(resolutionMs));
    this.renderRuler();
  }

  // --- Node CRUD Operations ---
  createNode(trackId, presetId, startTime, saveHistory = true) {
    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset) return null;

    const snappedStart = this.snapMs(startTime);
    
    // Check if a node already exists at this exact track and timestamp
    const duplicate = this.tracks[trackId].nodes.find(n => n.startTime === snappedStart);
    if (duplicate) {
      this.selectNode(duplicate);
      return duplicate;
    }

    if (saveHistory) this.saveStateToHistory();

    const node = {
      id: "node_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      track: trackId,
      presetId: preset.id,
      family: preset.family,
      startTime: snappedStart,
      duration: preset.duration,
      intensity: preset.intensity,
      presetName: preset.name
    };

    this.tracks[trackId].nodes.push(node);
    this.renderNode(node);
    this.selectNode(node);

    if (this.onTimelineUpdateCallback) this.onTimelineUpdateCallback();
    return node;
  }

  deleteNode(nodeId, saveHistory = true) {
    for (const trackId of ["L", "R"]) {
      const idx = this.tracks[trackId].nodes.findIndex(n => n.id === nodeId);
      if (idx !== -1) {
        if (saveHistory) this.saveStateToHistory();
        const [removed] = this.tracks[trackId].nodes.splice(idx, 1);
        if (this.selectedNode === removed) {
          this.selectNode(null);
        }
        
        // Remove element from DOM
        const el = document.getElementById(nodeId);
        if (el) el.remove();

        if (this.onTimelineUpdateCallback) this.onTimelineUpdateCallback();
        break;
      }
    }
  }

  clear(saveHistory = true) {
    if (saveHistory) this.saveStateToHistory();
    this.selectNode(null);
    this.tracks.L.nodes = [];
    this.tracks.R.nodes = [];
    this.renderAllNodes();
    if (this.onTimelineUpdateCallback) this.onTimelineUpdateCallback();
  }

  updateNodeProperties(nodeId, properties, triggerSelectionChange = true, saveHistory = true) {
    const node = this.findNode(nodeId);
    if (!node) return;

    if (saveHistory) this.saveStateToHistory();

    Object.assign(node, properties);

    // If presetId changed, pull duration, name, and family mappings
    if (properties.presetId) {
      const preset = PRESETS.find(p => p.id === properties.presetId);
      if (preset) {
        node.presetId = preset.id;
        node.duration = preset.duration;
        node.intensity = preset.intensity;
        node.presetName = preset.name;
        node.family = preset.family;
      }
    }

    // Handle track switches
    if (properties.track && properties.track !== node.track) {
      const oldTrack = node.track === "L" ? "R" : "L";
      this.tracks[oldTrack].nodes = this.tracks[oldTrack].nodes.filter(n => n.id !== node.id);
      node.track = properties.track;
      this.tracks[node.track].nodes.push(node);
    }

    if (properties.startTime !== undefined) {
      node.startTime = this.snapMs(node.startTime);
    }

    // Refresh rendering
    const el = document.getElementById(node.id);
    if (el) el.remove();
    this.renderNode(node);

    if (triggerSelectionChange && this.selectedNode && this.selectedNode.id === node.id) {
      this.selectNode(node); // refresh selection UI
    }

    if (this.onTimelineUpdateCallback) this.onTimelineUpdateCallback();
  }

  findNode(nodeId) {
    return this.tracks.L.nodes.find(n => n.id === nodeId) || 
           this.tracks.R.nodes.find(n => n.id === nodeId);
  }

  selectNodes(nodes) {
    // Clear previous visual outlines
    document.querySelectorAll(".haptic-node").forEach(el => el.classList.remove("selected"));
    
    this.selectedNodes.clear();
    
    if (nodes && nodes.length > 0) {
      nodes.forEach(node => {
        this.selectedNodes.add(node);
        const el = document.getElementById(node.id);
        if (el) el.classList.add("selected");
      });
      // Maintain selectedNode as the last one in the list for inspector compatibility
      this.selectedNode = nodes[nodes.length - 1];
    } else {
      this.selectedNode = null;
    }
    
    if (this.onSelectionChangeCallback) {
      this.onSelectionChangeCallback(this.selectedNode, Array.from(this.selectedNodes));
    }
  }

  selectNode(node) {
    this.selectNodes(node ? [node] : []);
  }

  deleteNodes(nodeIds, saveHistory = true) {
    if (saveHistory) this.saveStateToHistory();
    this.selectNodes([]);
    
    let deletedAny = false;
    for (const trackId of ["L", "R"]) {
      this.tracks[trackId].nodes = this.tracks[trackId].nodes.filter(node => {
        if (nodeIds.includes(node.id)) {
          const el = document.getElementById(node.id);
          if (el) el.remove();
          deletedAny = true;
          return false;
        }
        return true;
      });
    }
    
    if (deletedAny && this.onTimelineUpdateCallback) {
      this.onTimelineUpdateCallback();
    }
  }

  copyNodes() {
    const list = this.selectedNodes.size > 0 ? Array.from(this.selectedNodes) : (this.selectedNode ? [this.selectedNode] : []);
    if (list.length === 0) return;

    // Find the leftmost startTime to use as anchor relative offset
    const minStart = Math.min(...list.map(n => n.startTime));

    this.clipboardNodes = list.map(n => ({
      presetId: n.presetId,
      track: n.track,
      offsetMs: n.startTime - minStart
    }));

    console.log(`Copied ${list.length} blocks to clipboard.`);
  }

  pasteNodes(targetTrack, targetTimeMs) {
    if (!this.clipboardNodes || this.clipboardNodes.length === 0) return;

    // Save history ONCE before pasting begins!
    this.saveStateToHistory();

    // Clear active selections
    this.selectNodes([]);

    const track = targetTrack || "L";
    const timeMs = targetTimeMs !== null && targetTimeMs !== undefined ? targetTimeMs : this.playheadTime;

    // If the copied tiles all belonged to a single track, we paste all of them onto the target track.
    // Otherwise, we preserve their individual original tracks and just time shift them.
    const spansSingleTrack = this.clipboardNodes.every(n => n.track === this.clipboardNodes[0].track);
    const newNodes = [];

    this.clipboardNodes.forEach(c => {
      const destTrack = spansSingleTrack ? track : c.track;
      const destTime = this.snapMs(timeMs + c.offsetMs);

      // Protect timeline boundaries
      if (destTime < this.totalDuration) {
        // Pass false as 4th parameter (saveHistory=false) to prevent sub-saves
        const node = this.createNode(destTrack, c.presetId, destTime, false);
        if (node) {
          newNodes.push(node);
        }
      }
    });

    if (newNodes.length > 0) {
      // Auto-select newly pasted nodes for polished visual confirmation and instant dragging
      this.selectNodes(newNodes);

      if (this.onTimelineUpdateCallback) {
        this.onTimelineUpdateCallback();
      }
      console.log(`Pasted ${newNodes.length} blocks.`);
    }
  }

  saveStateToHistory() {
    const snapshot = {
      L: this.tracks.L.nodes.map(n => ({ ...n })),
      R: this.tracks.R.nodes.map(n => ({ ...n })),
      controlPoints: this.controlPoints.map(cp => ({ ...cp })),
      mode: this.mode
    };

    this.undoStack.push(snapshot);
    this.redoStack = []; // Clear redo stack on new action

    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }
  }

  undo() {
    if (this.undoStack.length === 0) return;

    const currentState = {
      L: this.tracks.L.nodes.map(n => ({ ...n })),
      R: this.tracks.R.nodes.map(n => ({ ...n })),
      controlPoints: this.controlPoints.map(cp => ({ ...cp })),
      mode: this.mode
    };
    this.redoStack.push(currentState);

    const prevState = this.undoStack.pop();
    this.tracks.L.nodes = prevState.L;
    this.tracks.R.nodes = prevState.R;
    this.controlPoints = prevState.controlPoints;

    const modeChanged = this.mode !== prevState.mode;
    this.mode = prevState.mode;

    // Clear active selections
    this.selectNodes([]);
    
    // Refresh rendering
    this.renderAllNodes();

    if (this.onTimelineUpdateCallback) {
      this.onTimelineUpdateCallback();
    }

    if (modeChanged || this.mode === "curve") {
      if (this.onCurveUpdateCallback) {
        this.onCurveUpdateCallback();
      }
    }

    console.log("Undo executed.");
  }

  redo() {
    if (this.redoStack.length === 0) return;

    const currentState = {
      L: this.tracks.L.nodes.map(n => ({ ...n })),
      R: this.tracks.R.nodes.map(n => ({ ...n })),
      controlPoints: this.controlPoints.map(cp => ({ ...cp })),
      mode: this.mode
    };
    this.undoStack.push(currentState);

    const nextState = this.redoStack.pop();
    this.tracks.L.nodes = nextState.L;
    this.tracks.R.nodes = nextState.R;
    this.controlPoints = nextState.controlPoints;

    const modeChanged = this.mode !== nextState.mode;
    this.mode = nextState.mode;

    this.selectNodes([]);
    this.renderAllNodes();

    if (this.onTimelineUpdateCallback) {
      this.onTimelineUpdateCallback();
    }

    if (modeChanged || this.mode === "curve") {
      if (this.onCurveUpdateCallback) {
        this.onCurveUpdateCallback();
      }
    }

    console.log("Redo executed.");
  }

  // --- Render Layout System ---
  renderRuler() {
    // Remove only existing time ticks to preserve the SVG canvas and its event listeners
    const ticks = this.rulerContentEl.querySelectorAll(".time-tick");
    ticks.forEach(tick => tick.remove());
    const totalPx = this.msToPx(this.totalDuration);
    this.rulerContentEl.style.width = `${totalPx}px`;
    
    // Width sizing on track grids
    const leftContent = this.tracks.L.el.querySelector(".track-content");
    const rightContent = this.tracks.R.el.querySelector(".track-content");
    leftContent.style.width = `${totalPx}px`;
    rightContent.style.width = `${totalPx}px`;

    // Dynamic grid overlay sizing matching snap resolution divisions
    const snapMsPx = this.msToPx(this.snapResolution);
    const overlayGrids = document.querySelectorAll(".track-grid-overlay");
    overlayGrids.forEach(el => {
      el.style.backgroundSize = `${snapMsPx}px 100%`;
      el.style.width = `${totalPx}px`;
    });

    // Populate timeline ticks every 100ms
    for (let ms = 0; ms <= this.totalDuration; ms += 100) {
      const tick = document.createElement("div");
      tick.className = "time-tick";
      tick.style.left = `${this.msToPx(ms)}px`;

      if (ms % 500 === 0) {
        tick.innerText = `${ms}ms`;
      } else {
        tick.classList.add("minor");
      }
      this.rulerContentEl.appendChild(tick);
    }
  }

  renderNode(node) {
    const trackContent = this.tracks[node.track].el.querySelector(".track-content");
    
    const nodeEl = document.createElement("div");
    nodeEl.id = node.id;
    nodeEl.className = "haptic-node";
    
    // Dimensions
    const x = this.msToPx(node.startTime);
    const w = Math.max(30, this.msToPx(node.duration)); // minimum visual width for clicks
    nodeEl.style.left = `${x}px`;
    nodeEl.style.width = `${w}px`;

    // Custom properties to trigger CSS HSL color & height modifiers based on intensity
    // Intensity mapping: scaleY(0.4 to 1.0), Lightness(25% to 55%), Saturation(40% to 100%)
    const intensity = node.intensity || 1.0;
    const hScale = 0.45 + (intensity * 0.55);
    const sat = 45 + Math.round(intensity * 55);
    const lightness = 25 + Math.round(intensity * 25);

    nodeEl.style.setProperty("--h-scale", hScale);
    nodeEl.style.setProperty("--sat", `${sat}%`);
    nodeEl.style.setProperty("--lightness", `${lightness}%`);

    nodeEl.innerHTML = `
      <div class="node-title">${node.presetName}</div>
      <div class="node-time">${node.startTime}ms</div>
    `;

    // Visual selection outline sync
    if (this.selectedNode && this.selectedNode.id === node.id) {
      nodeEl.classList.add("selected");
    }

    // Interaction bindings: Click to select, mouse drag to move
    nodeEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      // If the clicked node is already part of the selected set, don't clear the rest of the selection!
      if (!this.selectedNodes.has(node)) {
        this.selectNode(node);
      }
      this.initNodeDrag(e, node, nodeEl);
    });

    trackContent.appendChild(nodeEl);
  }

  renderAllNodes() {
    // Clear all existing haptic DOM nodes
    document.querySelectorAll(".haptic-node").forEach(el => el.remove());
    this.tracks.L.nodes.forEach(node => this.renderNode(node));
    this.tracks.R.nodes.forEach(node => this.renderNode(node));
  }

  initNodeDrag(e, node, nodeEl) {
    if (this.mode === "curve") return;

    const startX = e.clientX;
    const startY = e.clientY;

    // Check if we are in a multi-drag scenario
    const isMultiDrag = this.selectedNodes.size > 1 && this.selectedNodes.has(node);

    // Snapshot nodes to drag
    const dragNodes = isMultiDrag ? Array.from(this.selectedNodes) : [node];

    // Save initial state of each node
    const nodeSnapshots = dragNodes.map(n => {
      const el = document.getElementById(n.id);
      return {
        node: n,
        el: el,
        initialLeft: el ? parseFloat(el.style.left) : parseFloat(this.msToPx(n.startTime)),
        initialStartTime: n.startTime,
        initialTrack: n.track,
        intensity: n.intensity || 1.0
      };
    });

    const anchorSnapshot = nodeSnapshots.find(s => s.node.id === node.id);
    let finalTrack = node.track;

    // Track switching containers and tracking
    const leftTrackContent = this.tracks.L.el.querySelector(".track-content");
    const rightTrackContent = this.tracks.R.el.querySelector(".track-content");

    // Boundary constraints for all dragging nodes
    const minStartTime = Math.min(...dragNodes.map(n => n.startTime));
    const maxEndTime = Math.max(...dragNodes.map(n => n.startTime + n.duration));

    // Mark all dragging nodes visually
    nodeSnapshots.forEach(s => {
      if (s.el) s.el.classList.add("dragging");
    });

    let hasMoved = false;
    let snappedDeltaMs = 0;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      // Distinguish click from drag
      if (!hasMoved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
        hasMoved = true;
      }

      // Calculate timing shift in ms from physical cursor shift deltaX
      let deltaMs = this.pxToMs(deltaX);

      // Clamp deltaMs so that no node goes out of timeline boundaries:
      if (minStartTime + deltaMs < 0) {
        deltaMs = -minStartTime;
      }
      if (maxEndTime + deltaMs > this.totalDuration) {
        deltaMs = this.totalDuration - maxEndTime;
      }

      // Snap the anchor node's new position
      const targetAnchorStart = anchorSnapshot.initialStartTime + deltaMs;
      const snappedAnchorStart = this.snapMs(targetAnchorStart);
      snappedDeltaMs = snappedAnchorStart - anchorSnapshot.initialStartTime;

      // Vertical track boundaries channel switching
      const leftRect = leftTrackContent.getBoundingClientRect();
      const rightRect = rightTrackContent.getBoundingClientRect();
      const mouseY = moveEvent.clientY;

      let targetTrack = node.track;
      const leftCenter = leftRect.top + leftRect.height / 2;
      const rightCenter = rightRect.top + rightRect.height / 2;
      const distToLeft = Math.abs(mouseY - leftCenter);
      const distToRight = Math.abs(mouseY - rightCenter);

      if (distToLeft < distToRight) {
        targetTrack = "L";
      } else {
        targetTrack = "R";
      }

      // If track preview changed, dynamically swap color tone
      if (targetTrack !== finalTrack) {
        finalTrack = targetTrack;
      }

      // Update all dragged nodes in real time visually
      nodeSnapshots.forEach(s => {
        if (!s.el) return;

        // Apply shift
        const newLeft = this.msToPx(s.initialStartTime + snappedDeltaMs);
        s.el.style.left = `${newLeft}px`;

        // Vertical visual offset translate and LRA track preview
        const hScale = 0.45 + (s.intensity * 0.55);
        s.el.style.transform = `translateY(${deltaY}px) scaleY(${hScale})`;
        s.el.style.setProperty("--node-base", finalTrack === "L" ? "180" : "285");

        // Display updated snap times
        s.el.querySelector(".node-time").innerText = `${s.initialStartTime + snappedDeltaMs}ms`;
      });
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      // Clean up styles
      nodeSnapshots.forEach(s => {
        if (s.el) {
          s.el.classList.remove("dragging");
          s.el.style.transform = "";
        }
      });

      if (!hasMoved) {
        // If it was a simple click on an already multi-selected node,
        // clear the selection and select only this clicked node.
        if (isMultiDrag) {
          this.selectNode(node);
        }
        return;
      }

      // Apply changes to database/sequencer state
      if (isMultiDrag) {
        // Snapshot to avoid mutation conflicts during batch iteration
        const snapshot = nodeSnapshots.map(s => s.node);
        nodeSnapshots.forEach(s => {
          this.updateNodeProperties(s.node.id, {
            startTime: s.initialStartTime + snappedDeltaMs,
            track: finalTrack
          }, false);
        });

        // Single visual/state re-selection refresh
        this.selectNodes(snapshot);
      } else {
        // Single node drag
        this.updateNodeProperties(node.id, {
          startTime: anchorSnapshot.initialStartTime + snappedDeltaMs,
          track: finalTrack
        });
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  // --- Drag & Drop from Library ---
  initEventListeners() {
    // Add wrapper-based mouse event listener for marquee selection and click-to-create nodes
    const wrapper = document.querySelector(".timeline-grid-wrapper");
    if (wrapper) {
      wrapper.addEventListener("mousedown", (e) => {
        if (this.mode === "curve") return;

        // Only left click starts selection
        if (e.button !== 0) return;

        // Only start selection if clicking on the background of tracks or empty areas
        const isBackground = e.target.classList.contains("timeline-grid-wrapper") || 
                             e.target.classList.contains("track-content") || 
                             e.target.classList.contains("track-grid-overlay") ||
                             e.target.id === "timeRuler" ||
                             e.target.id === "rulerContent";

        if (!isBackground) return;

        e.preventDefault();

        const rect = wrapper.getBoundingClientRect();
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;

        let marquee = null;
        let isDragging = false;
        
        // Gather all existing nodes across both tracks
        const allNodes = [...this.tracks.L.nodes, ...this.tracks.R.nodes];

        const onMouseMove = (moveEvent) => {
          const moveX = moveEvent.clientX - rect.left;
          const moveY = moveEvent.clientY - rect.top;

          const deltaX = Math.abs(moveEvent.clientX - e.clientX);
          const deltaY = Math.abs(moveEvent.clientY - e.clientY);

          // Only start marquee if mouse was dragged more than 5px to distinguish from simple click
          if (!isDragging && (deltaX > 5 || deltaY > 5)) {
            isDragging = true;
            marquee = document.createElement("div");
            marquee.className = "selection-marquee";
            wrapper.appendChild(marquee);
          }

          if (isDragging && marquee) {
            const x1 = Math.min(startX, moveX);
            const y1 = Math.min(startY, moveY);
            const x2 = Math.max(startX, moveX);
            const y2 = Math.max(startY, moveY);

            marquee.style.left = `${x1}px`;
            marquee.style.top = `${y1}px`;
            marquee.style.width = `${x2 - x1}px`;
            marquee.style.height = `${y2 - y1}px`;

            // Check intersections in real-time
            allNodes.forEach(node => {
              const nodeEl = document.getElementById(node.id);
              if (!nodeEl) return;

              const nodeRect = nodeEl.getBoundingClientRect();
              const nodeLeft = nodeRect.left - rect.left;
              const nodeRight = nodeRect.right - rect.left;
              const nodeTop = nodeRect.top - rect.top;
              const nodeBottom = nodeRect.bottom - rect.top;

              // Check overlap boundary intersections
              const overlaps = !(x2 < nodeLeft || x1 > nodeRight || y2 < nodeTop || y1 > nodeBottom);
              if (overlaps) {
                nodeEl.classList.add("selected");
              } else {
                nodeEl.classList.remove("selected");
              }
            });
          }
        };

        const onMouseUp = (upEvent) => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);

          if (isDragging) {
            if (marquee) {
              marquee.remove();
            }

            // Gather all nodes that are currently visually selected
            const selected = [];
            allNodes.forEach(node => {
              const nodeEl = document.getElementById(node.id);
              if (nodeEl && nodeEl.classList.contains("selected")) {
                selected.push(node);
              }
            });

            this.selectNodes(selected);
          } else {
            // It was a simple click!
            // Clear current multi-selection
            this.selectNodes([]);

            // If clicked inside track-content, create a new node
            const clickTarget = e.target;
            const trackContent = clickTarget.closest(".track-content");
            if (trackContent) {
              const trackEl = trackContent.closest(".track");
              const trackId = trackEl.id === "leftTrack" ? "L" : "R";
              
              const contentRect = trackContent.getBoundingClientRect();
              const clickX = e.clientX - contentRect.left;
              const time = this.pxToMs(clickX);
              
              const defaultPreset = trackId === "L" ? 1 : 4;
              this.createNode(trackId, defaultPreset, time);
            }
          }
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    }

    for (const trackId of ["L", "R"]) {
      const content = this.tracks[trackId].el.querySelector(".track-content");

      // Track mouse position over tracks for Copy & Paste target coordinates
      content.addEventListener("mousemove", (e) => {
        if (this.mode === "curve") return;
        const rect = content.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        this.hoveredTrack = trackId;
        this.hoveredTimeMs = this.snapMs(this.pxToMs(mouseX));
      });

      content.addEventListener("mouseleave", () => {
        this.hoveredTrack = null;
        this.hoveredTimeMs = null;
      });

      // Drag over tracks
      content.addEventListener("dragover", (e) => {
        if (this.mode === "curve") {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      });

      // Drop items
      content.addEventListener("drop", (e) => {
        if (this.mode === "curve") {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        try {
          const rawData = e.dataTransfer.getData("application/json");
          if (!rawData) return;

          const data = JSON.parse(rawData);
          const rect = content.getBoundingClientRect();
          const dropX = e.clientX - rect.left;
          const time = this.pxToMs(dropX);

          const presetId = parseInt(data.primaryPresetId);
          this.createNode(trackId, presetId, time);
        } catch (err) {
          console.error("Timeline drop parsing failed:", err);
        }
      });
    }
  }

  // --- Playback and Playhead Loop ---
  setPlayheadTime(time) {
    this.playheadTime = Math.max(0, Math.min(time, this.totalDuration));
    this.updatePlayheadVisual();
    if (this.onPlayheadMoveCallback) this.onPlayheadMoveCallback(this.playheadTime);
  }

  updatePlayheadVisual() {
    const x = this.msToPx(this.playheadTime);
    this.playheadEl.style.left = `${x}px`;
  }

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.playheadEl.classList.add("active");
    this.lastFrameTime = performance.now();
    
    // Reset playhead trigger markers
    this.triggeredThisLoop = new Set();
    
    this.animationFrameId = requestAnimationFrame((timestamp) => this.playbackLoop(timestamp));
  }

  stop() {
    this.isPlaying = false;
    this.playheadEl.classList.remove("active");
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.setPlayheadTime(0);
  }

  playbackLoop(timestamp) {
    if (!this.isPlaying) return;

    const delta = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    const prevTime = this.playheadTime;
    let nextTime = prevTime + delta;

    let wrapped = false;
    if (nextTime >= this.totalDuration) {
      if (this.isLooping) {
        nextTime = nextTime % this.totalDuration;
        this.triggeredThisLoop.clear();
        wrapped = true;
      } else {
        this.stop();
        return;
      }
    }

    // Precise Collision Detection in semi-closed time interval [prevTime, nextTime)
    this.checkCollisions(prevTime, nextTime, wrapped);

    this.setPlayheadTime(nextTime);

    this.animationFrameId = requestAnimationFrame((ts) => this.playbackLoop(ts));
  }

  /**
   * Scans all nodes and dispatches serial packets when playhead crosses a node start time.
   */
  checkCollisions(prevTime, nextTime, wrapped) {
    const checkTrackCollisions = (trackId) => {
      for (const node of this.tracks[trackId].nodes) {
        let isTriggered = false;

        if (!wrapped) {
          // Normal segment traversal
          if (node.startTime >= prevTime && node.startTime < nextTime) {
            isTriggered = true;
          }
        } else {
          // Wrapped segment check: split into [prevTime, totalDuration) and [0, nextTime)
          if ((node.startTime >= prevTime && node.startTime < this.totalDuration) ||
              (node.startTime >= 0 && node.startTime < nextTime)) {
            isTriggered = true;
          }
        }

        // Safeguard to guarantee we only dispatch once per node cross segment
        if (isTriggered && !this.triggeredThisLoop.has(node.id)) {
          this.triggeredThisLoop.add(node.id);
          this.triggerHardware(node);
        }
      }
    };

    checkTrackCollisions("L");
    checkTrackCollisions("R");
  }

  /**
   * Instantly fires a transmit call to Web Serial and updates the active node visual glow
   */
  triggerHardware(node) {
    // Send packet: target driver 'L' or 'R' and the exact preset id
    serialManager.transmit(node.track, node.presetId);

    // Create transient micro-animation glow in the timeline
    const el = document.getElementById(node.id);
    if (el) {
      el.style.filter = "brightness(1.5) contrast(1.1)";
      setTimeout(() => {
        if (document.getElementById(node.id)) {
          el.style.filter = "";
        }
      }, 100);
    }
  }

  // --- File Serialization (Load/Save JSON Tracks) ---
  exportJSON() {
    const data = {
      version: 1.0,
      totalDuration: this.totalDuration,
      tracks: {
        L: this.tracks.L.nodes.map(n => ({ startTime: n.startTime, presetId: n.presetId })),
        R: this.tracks.R.nodes.map(n => ({ startTime: n.startTime, presetId: n.presetId }))
      }
    };
    return JSON.stringify(data, null, 2);
  }

  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || !data.tracks) throw new Error("Invalid haptic composer sequence file.");

      // Save history ONCE before importing a sequence!
      this.saveStateToHistory();

      // Clear timeline selection & active nodes
      this.selectNode(null);
      this.tracks.L.nodes = [];
      this.tracks.R.nodes = [];
      
      this.setTotalDuration(data.totalDuration || 1000);

      // Populate L
      if (data.tracks.L) {
        data.tracks.L.forEach(n => {
          this.createNode("L", n.presetId, n.startTime, false);
        });
      }

      // Populate R
      if (data.tracks.R) {
        data.tracks.R.forEach(n => {
          this.createNode("R", n.presetId, n.startTime, false);
        });
      }

      this.renderAllNodes();
      this.selectNode(null);
      console.log("Timeline sequence loaded successfully.");
      return true;
    } catch (err) {
      alert("Failed to load sequence file. Check console details.");
      console.error(err);
      return false;
    }
  }

  // --- Frequency Generation & Curve Visualization ---
  generateFrequencySequence(params) {
    const { shape, baseInterval, peakInterval, crestPosition, routing, presetId, dynamicIntensity } = params;

    // Save history ONCE before generating dynamic curves!
    this.saveStateToHistory();

    // Temporarily clear tracks before generating
    this.tracks.L.nodes = [];
    this.tracks.R.nodes = [];

    let t = 0;
    let alternateFlag = true;

    // To avoid infinite loops, guarantee a minimum step interval of 20ms
    const minStep = Math.max(20, peakInterval);
    const D = this.totalDuration;

    const placedTimes = { L: new Set(), R: new Set() };

    while (t < D) {
      const x = t / D;
      let f_t = 0;

      if (shape === "gaussian") {
        const diff = x - crestPosition;
        const sigma = 0.18; // nice bell width
        f_t = Math.exp(-(diff * diff) / (2 * sigma * sigma));
      } else if (shape === "sine") {
        const cycles = 2;
        f_t = 0.5 + 0.5 * Math.cos(2 * Math.PI * cycles * (x - crestPosition));
      } else if (shape === "linear") {
        if (x < crestPosition) {
          f_t = crestPosition > 0 ? (x / crestPosition) : 1;
        } else {
          f_t = crestPosition < 1 ? ((1 - x) / (1 - crestPosition)) : 1;
        }
      } else if (shape === "custom") {
        // Find matching linear segment between adjacent control points
        let idx = 0;
        for (let i = 0; i < this.controlPoints.length - 1; i++) {
          if (x >= this.controlPoints[i].x && x <= this.controlPoints[i+1].x) {
            idx = i;
            break;
          }
        }
        const p0 = this.controlPoints[idx];
        const p1 = this.controlPoints[idx+1];
        const span = p1.x - p0.x;
        const pct = span > 0 ? (x - p0.x) / span : 0;
        f_t = p0.y + (p1.y - p0.y) * pct;
      }

      f_t = Math.max(0, Math.min(1, f_t));

      // Compute interval at current time
      const interval = baseInterval - (baseInterval - peakInterval) * f_t;

      // In Curve/Frequency Mode, haptic pulses must be timed with millisecond precision
      // to follow the visual pacing curve smoothly, rather than snapping to the blocky grid columns.
      const snappedT = Math.round(t);

      if (snappedT < D) {
        const addNodeToTrack = (trackId) => {
          if (!placedTimes[trackId].has(snappedT)) {
            placedTimes[trackId].add(snappedT);

            let selectedPresetId = presetId;
            let currentPreset = PRESETS.find(p => p.id === presetId) || PRESETS[0];

            if (dynamicIntensity) {
              const matchedFamily = FAMILIES.find(f => f.name === currentPreset.family);
              if (matchedFamily && matchedFamily.members.length > 1) {
                // Map f_t (0 to 1) to family members
                // f_t = 1.0 (fast peak) -> triggers strongest member (index 0)
                // f_t = 0.0 (slow valley) -> triggers weakest member (index N-1)
                const N = matchedFamily.members.length;
                const memberIdx = Math.max(0, Math.min(N - 1, Math.floor((1.0 - f_t) * N)));
                const chosenMember = matchedFamily.members[memberIdx];
                selectedPresetId = chosenMember.id;
                currentPreset = chosenMember;
              }
            }

            const node = {
              id: "node_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
              track: trackId,
              presetId: selectedPresetId,
              family: currentPreset.family,
              startTime: snappedT,
              duration: currentPreset.duration,
              intensity: currentPreset.intensity,
              presetName: currentPreset.name
            };
            this.tracks[trackId].nodes.push(node);
          }
        };

        if (routing === "both") {
          addNodeToTrack("L");
          addNodeToTrack("R");
        } else if (routing === "L") {
          addNodeToTrack("L");
        } else if (routing === "R") {
          addNodeToTrack("R");
        } else if (routing === "alternate") {
          addNodeToTrack(alternateFlag ? "L" : "R");
          alternateFlag = !alternateFlag;
        }
      }

      t += Math.max(minStep, interval);
    }

    this.tracks.L.nodes.sort((a, b) => a.startTime - b.startTime);
    this.tracks.R.nodes.sort((a, b) => a.startTime - b.startTime);

    this.renderAllNodes();
    if (this.onTimelineUpdateCallback) this.onTimelineUpdateCallback();
  }

  drawCurveVisualization(params) {
    const { shape, crestPosition } = params;
    const pathEl = document.getElementById("rulerCurvePath");
    if (!pathEl) return;

    const totalPx = this.msToPx(this.totalDuration);
    if (totalPx <= 0) return;

    let pathD = "";

    for (let px = 0; px <= totalPx; px += 5) {
      const x = px / totalPx;
      let f_t = 0;

      if (shape === "gaussian") {
        const diff = x - crestPosition;
        const sigma = 0.18;
        f_t = Math.exp(-(diff * diff) / (2 * sigma * sigma));
      } else if (shape === "sine") {
        const cycles = 2;
        f_t = 0.5 + 0.5 * Math.cos(2 * Math.PI * cycles * (x - crestPosition));
      } else if (shape === "linear") {
        if (x < crestPosition) {
          f_t = crestPosition > 0 ? (x / crestPosition) : 1;
        } else {
          f_t = crestPosition < 1 ? ((1 - x) / (1 - crestPosition)) : 1;
        }
      } else if (shape === "custom") {
        let idx = 0;
        for (let i = 0; i < this.controlPoints.length - 1; i++) {
          if (x >= this.controlPoints[i].x && x <= this.controlPoints[i+1].x) {
            idx = i;
            break;
          }
        }
        const p0 = this.controlPoints[idx];
        const p1 = this.controlPoints[idx+1];
        const span = p1.x - p0.x;
        const pct = span > 0 ? (x - p0.x) / span : 0;
        f_t = p0.y + (p1.y - p0.y) * pct;
      }

      f_t = Math.max(0, Math.min(1, f_t));
      const y = 30 - 24 * f_t;

      if (px === 0) {
        pathD += `M ${px} ${y}`;
      } else {
        pathD += ` L ${px} ${y}`;
      }
    }

    pathEl.setAttribute("d", pathD);
    
    // Auto-update handle circles positions to match timeline zoom width dynamically!
    this.renderControlPoints();
  }
}
