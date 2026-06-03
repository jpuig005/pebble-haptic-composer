// Complete library of all 123 TI DRV2605L standard waveforms
// Structured exactly as specified on page 63/64 of the datasheet.
// Grouped into visual "Variant Families" with intensity tiers for smart bundling in UI.

export const PRESETS = [
  // --- STRONGER baseline clicks ---
  { id: 1, name: "Strong Click - 100%", family: "Strong Click", intensity: 1.0, group: "1->3", duration: 80, category: "Clicks" },
  { id: 2, name: "Strong Click - 60%", family: "Strong Click", intensity: 0.6, group: "1->3", duration: 80, category: "Clicks" },
  { id: 3, name: "Strong Click - 30%", family: "Strong Click", intensity: 0.3, group: "1->3", duration: 80, category: "Clicks" },
  
  { id: 4, name: "Sharp Click - 100%", family: "Sharp Click", intensity: 1.0, group: "4->6", duration: 60, category: "Clicks" },
  { id: 5, name: "Sharp Click - 60%", family: "Sharp Click", intensity: 0.6, group: "4->6", duration: 60, category: "Clicks" },
  { id: 6, name: "Sharp Click - 30%", family: "Sharp Click", intensity: 0.3, group: "4->6", duration: 60, category: "Clicks" },
  
  { id: 7, name: "Soft Bump - 100%", family: "Soft Bump", intensity: 1.0, group: "7->9", duration: 120, category: "Bumps" },
  { id: 8, name: "Soft Bump - 60%", family: "Soft Bump", intensity: 0.6, group: "7->9", duration: 120, category: "Bumps" },
  { id: 9, name: "Soft Bump - 30%", family: "Soft Bump", intensity: 0.3, group: "7->9", duration: 120, category: "Bumps" },
  
  { id: 10, name: "Double Click - 100%", family: "Double Click", intensity: 1.0, group: "10->11", duration: 180, category: "Clicks" },
  { id: 11, name: "Double Click - 60%", family: "Double Click", intensity: 0.6, group: "10->11", duration: 180, category: "Clicks" },
  
  { id: 12, name: "Triple Click - 100%", family: "Triple Click", intensity: 1.0, group: "12", duration: 250, category: "Clicks" },
  { id: 13, name: "Soft Fuzz - 60%", family: "Soft Fuzz", intensity: 0.6, group: "13", duration: 300, category: "Fuzz/Buzz" },
  { id: 14, name: "Strong Buzz - 100%", family: "Strong Buzz", intensity: 1.0, group: "14", duration: 400, category: "Fuzz/Buzz" },
  
  { id: 15, name: "750 ms Alert 100%", family: "Alert Pulse", intensity: 1.0, group: "15->16", duration: 750, category: "Alerts" },
  { id: 16, name: "1000 ms Alert 100%", family: "Alert Pulse", intensity: 1.0, group: "15->16", duration: 1000, category: "Alerts" },

  // --- STRONG CLICK VARIANT FAMILY (17-20) ---
  { id: 17, name: "Strong Click 1 - 100%", family: "Strong Click 1-4", intensity: 1.0, group: "17->20", duration: 80, category: "Clicks" },
  { id: 18, name: "Strong Click 2 - 80%", family: "Strong Click 1-4", intensity: 0.8, group: "17->20", duration: 80, category: "Clicks" },
  { id: 19, name: "Strong Click 3 - 60%", family: "Strong Click 1-4", intensity: 0.6, group: "17->20", duration: 80, category: "Clicks" },
  { id: 20, name: "Strong Click 4 - 30%", family: "Strong Click 1-4", intensity: 0.3, group: "17->20", duration: 80, category: "Clicks" },

  // --- MEDIUM CLICK FAMILY (21-23) ---
  { id: 21, name: "Medium Click 1 - 100%", family: "Medium Click", intensity: 1.0, group: "21->23", duration: 70, category: "Clicks" },
  { id: 22, name: "Medium Click 2 - 80%", family: "Medium Click", intensity: 0.8, group: "21->23", duration: 70, category: "Clicks" },
  { id: 23, name: "Medium Click 3 - 60%", family: "Medium Click", intensity: 0.6, group: "21->23", duration: 70, category: "Clicks" },

  // --- SHARP TICK FAMILY (24-26) ---
  { id: 24, name: "Sharp Tick 1 - 100%", family: "Sharp Tick", intensity: 1.0, group: "24->26", duration: 40, category: "Clicks" },
  { id: 25, name: "Sharp Tick 2 - 80%", family: "Sharp Tick", intensity: 0.8, group: "24->26", duration: 40, category: "Clicks" },
  { id: 26, name: "Sharp Tick 3 - 60%", family: "Sharp Tick", intensity: 0.6, group: "24->26", duration: 40, category: "Clicks" },

  // --- SHORT DOUBLE CLICK STRONG (27-30) ---
  { id: 27, name: "Short Double Click Strong 1 - 100%", family: "Short Dbl Click Strong", intensity: 1.0, group: "27->30", duration: 120, category: "Double Clicks" },
  { id: 28, name: "Short Double Click Strong 2 - 80%", family: "Short Dbl Click Strong", intensity: 0.8, group: "27->30", duration: 120, category: "Double Clicks" },
  { id: 29, name: "Short Double Click Strong 3 - 60%", family: "Short Dbl Click Strong", intensity: 0.6, group: "27->30", duration: 120, category: "Double Clicks" },
  { id: 30, name: "Short Double Click Strong 4 - 30%", family: "Short Dbl Click Strong", intensity: 0.3, group: "27->30", duration: 120, category: "Double Clicks" },

  // --- SHORT DOUBLE CLICK MEDIUM (31-33) ---
  { id: 31, name: "Short Double Click Medium 1 - 100%", family: "Short Dbl Click Medium", intensity: 1.0, group: "31->33", duration: 110, category: "Double Clicks" },
  { id: 32, name: "Short Double Click Medium 2 - 80%", family: "Short Dbl Click Medium", intensity: 0.8, group: "31->33", duration: 110, category: "Double Clicks" },
  { id: 33, name: "Short Double Click Medium 3 - 60%", family: "Short Dbl Click Medium", intensity: 0.6, group: "31->33", duration: 110, category: "Double Clicks" },

  // --- SHORT DOUBLE SHARP TICK (34-36) ---
  { id: 34, name: "Short Double Sharp Tick 1 - 100%", family: "Short Dbl Sharp Tick", intensity: 1.0, group: "34->36", duration: 90, category: "Double Clicks" },
  { id: 35, name: "Short Double Sharp Tick 2 - 80%", family: "Short Dbl Sharp Tick", intensity: 0.8, group: "34->36", duration: 90, category: "Double Clicks" },
  { id: 36, name: "Short Double Sharp Tick 3 - 60%", family: "Short Dbl Sharp Tick", intensity: 0.6, group: "34->36", duration: 90, category: "Double Clicks" },

  // --- LONG DOUBLE SHARP CLICK STRONG (37-40) ---
  { id: 37, name: "Long Double Sharp Click Strong 1 - 100%", family: "Long Dbl Sharp Click Strong", intensity: 1.0, group: "37->40", duration: 180, category: "Double Clicks" },
  { id: 38, name: "Long Double Sharp Click Strong 2 - 80%", family: "Long Dbl Sharp Click Strong", intensity: 0.8, group: "37->40", duration: 180, category: "Double Clicks" },
  { id: 39, name: "Long Double Sharp Click Strong 3 - 60%", family: "Long Dbl Sharp Click Strong", intensity: 0.6, group: "37->40", duration: 180, category: "Double Clicks" },
  { id: 40, name: "Long Double Sharp Click Strong 4 - 30%", family: "Long Dbl Sharp Click Strong", intensity: 0.3, group: "37->40", duration: 180, category: "Double Clicks" },

  // --- LONG DOUBLE SHARP CLICK MEDIUM (41-43) ---
  { id: 41, name: "Long Double Sharp Click Medium 1 - 100%", family: "Long Dbl Sharp Click Medium", intensity: 1.0, group: "41->43", duration: 160, category: "Double Clicks" },
  { id: 42, name: "Long Double Sharp Click Medium 2 - 80%", family: "Long Dbl Sharp Click Medium", intensity: 0.8, group: "41->43", duration: 160, category: "Double Clicks" },
  { id: 43, name: "Long Double Sharp Click Medium 3 - 60%", family: "Long Dbl Sharp Click Medium", intensity: 0.6, group: "41->43", duration: 160, category: "Double Clicks" },

  // --- LONG DOUBLE SHARP TICK (44-46) ---
  { id: 44, name: "Long Double Sharp Tick 1 - 100%", family: "Long Dbl Sharp Tick", intensity: 1.0, group: "44->46", duration: 130, category: "Double Clicks" },
  { id: 45, name: "Long Double Sharp Tick 2 - 80%", family: "Long Dbl Sharp Tick", intensity: 0.8, group: "44->46", duration: 130, category: "Double Clicks" },
  { id: 46, name: "Long Double Sharp Tick 3 - 60%", family: "Long Dbl Sharp Tick", intensity: 0.6, group: "44->46", duration: 130, category: "Double Clicks" },

  // --- BUZZ FAMILY (47-51) ---
  { id: 47, name: "Buzz 1 - 100%", family: "Buzz", intensity: 1.0, group: "47->51", duration: 350, category: "Fuzz/Buzz" },
  { id: 48, name: "Buzz 2 - 80%", family: "Buzz", intensity: 0.8, group: "47->51", duration: 350, category: "Fuzz/Buzz" },
  { id: 49, name: "Buzz 3 - 60%", family: "Buzz", intensity: 0.6, group: "47->51", duration: 350, category: "Fuzz/Buzz" },
  { id: 50, name: "Buzz 4 - 40%", family: "Buzz", intensity: 0.4, group: "47->51", duration: 350, category: "Fuzz/Buzz" },
  { id: 51, name: "Buzz 5 - 20%", family: "Buzz", intensity: 0.2, group: "47->51", duration: 350, category: "Fuzz/Buzz" },

  // --- PULSING STRONG (52-53) ---
  { id: 52, name: "Pulsing Strong 1 - 100%", family: "Pulsing Strong", intensity: 1.0, group: "52->53", duration: 400, category: "Pulses" },
  { id: 53, name: "Pulsing Strong 2 - 60%", family: "Pulsing Strong", intensity: 0.6, group: "52->53", duration: 400, category: "Pulses" },

  // --- PULSING MEDIUM (54-55) ---
  { id: 54, name: "Pulsing Medium 1 - 100%", family: "Pulsing Medium", intensity: 1.0, group: "54->55", duration: 350, category: "Pulses" },
  { id: 55, name: "Pulsing Medium 2 - 60%", family: "Pulsing Medium", intensity: 0.6, group: "54->55", duration: 350, category: "Pulses" },

  // --- PULSING SHARP (56-57) ---
  { id: 56, name: "Pulsing Sharp 1 - 100%", family: "Pulsing Sharp", intensity: 1.0, group: "56->57", duration: 250, category: "Pulses" },
  { id: 57, name: "Pulsing Sharp 2 - 60%", family: "Pulsing Sharp", intensity: 0.6, group: "56->57", duration: 250, category: "Pulses" },

  // --- TRANSITION CLICKS (58-63) ---
  { id: 58, name: "Transition Click 1 - 100%", family: "Transition Click", intensity: 1.0, group: "58->63", duration: 180, category: "Transitions" },
  { id: 59, name: "Transition Click 2 - 80%", family: "Transition Click", intensity: 0.8, group: "58->63", duration: 180, category: "Transitions" },
  { id: 60, name: "Transition Click 3 - 60%", family: "Transition Click", intensity: 0.6, group: "58->63", duration: 180, category: "Transitions" },
  { id: 61, name: "Transition Click 4 - 40%", family: "Transition Click", intensity: 0.4, group: "58->63", duration: 180, category: "Transitions" },
  { id: 62, name: "Transition Click 5 - 20%", family: "Transition Click", intensity: 0.2, group: "58->63", duration: 180, category: "Transitions" },
  { id: 63, name: "Transition Click 6 - 10%", family: "Transition Click", intensity: 0.1, group: "58->63", duration: 180, category: "Transitions" },

  // --- TRANSITION HUMS (64-69) ---
  { id: 64, name: "Transition Hum 1 - 100%", family: "Transition Hum", intensity: 1.0, group: "64->69", duration: 320, category: "Transitions" },
  { id: 65, name: "Transition Hum 2 - 80%", family: "Transition Hum", intensity: 0.8, group: "64->69", duration: 320, category: "Transitions" },
  { id: 66, name: "Transition Hum 3 - 60%", family: "Transition Hum", intensity: 0.6, group: "64->69", duration: 320, category: "Transitions" },
  { id: 67, name: "Transition Hum 4 - 40%", family: "Transition Hum", intensity: 0.4, group: "64->69", duration: 320, category: "Transitions" },
  { id: 68, name: "Transition Hum 5 - 20%", family: "Transition Hum", intensity: 0.2, group: "64->69", duration: 320, category: "Transitions" },
  { id: 69, name: "Transition Hum 6 - 10%", family: "Transition Hum", intensity: 0.1, group: "64->69", duration: 320, category: "Transitions" },

  // --- RAMPS AND SWEEPS (70-117) IN INTELLIGENT INTENSITY FAMILIES ---

  // Ramp Down Long Smooth (70->71, 94->95)
  { id: 70, name: "Transition Ramp Down Long Smooth 1 - 100 to 0%", family: "Ramp Down Long Smooth", intensity: 1.0, group: "70,71,94,95", duration: 600, category: "Sweeps" },
  { id: 71, name: "Transition Ramp Down Long Smooth 2 - 100 to 0%", family: "Ramp Down Long Smooth", intensity: 0.8, group: "70,71,94,95", duration: 600, category: "Sweeps" },
  { id: 94, name: "Transition Ramp Down Long Smooth 1 - 50 to 0%", family: "Ramp Down Long Smooth", intensity: 0.5, group: "70,71,94,95", duration: 600, category: "Sweeps" },
  { id: 95, name: "Transition Ramp Down Long Smooth 2 - 50 to 0%", family: "Ramp Down Long Smooth", intensity: 0.4, group: "70,71,94,95", duration: 600, category: "Sweeps" },

  // Ramp Down Medium Smooth (72->73, 96->97)
  { id: 72, name: "Transition Ramp Down Medium Smooth 1 - 100 to 0%", family: "Ramp Down Med Smooth", intensity: 1.0, group: "72,73,96,97", duration: 400, category: "Sweeps" },
  { id: 73, name: "Transition Ramp Down Medium Smooth 2 - 100 to 0%", family: "Ramp Down Med Smooth", intensity: 0.8, group: "72,73,96,97", duration: 400, category: "Sweeps" },
  { id: 96, name: "Transition Ramp Down Medium Smooth 1 - 50 to 0%", family: "Ramp Down Med Smooth", intensity: 0.5, group: "72,73,96,97", duration: 400, category: "Sweeps" },
  { id: 97, name: "Transition Ramp Down Medium Smooth 2 - 50 to 0%", family: "Ramp Down Med Smooth", intensity: 0.4, group: "72,73,96,97", duration: 400, category: "Sweeps" },

  // Ramp Down Short Smooth (74->75, 98->99)
  { id: 74, name: "Transition Ramp Down Short Smooth 1 - 100 to 0%", family: "Ramp Down Short Smooth", intensity: 1.0, group: "74,75,98,99", duration: 250, category: "Sweeps" },
  { id: 75, name: "Transition Ramp Down Short Smooth 2 - 100 to 0%", family: "Ramp Down Short Smooth", intensity: 0.8, group: "74,75,98,99", duration: 250, category: "Sweeps" },
  { id: 98, name: "Transition Ramp Down Short Smooth 1 - 50 to 0%", family: "Ramp Down Short Smooth", intensity: 0.5, group: "74,75,98,99", duration: 250, category: "Sweeps" },
  { id: 99, name: "Transition Ramp Down Short Smooth 2 - 50 to 0%", family: "Ramp Down Short Smooth", intensity: 0.4, group: "74,75,98,99", duration: 250, category: "Sweeps" },

  // Ramp Down Long Sharp (76->77, 100->101)
  { id: 76, name: "Transition Ramp Down Long Sharp 1 - 100 to 0%", family: "Ramp Down Long Sharp", intensity: 1.0, group: "76,77,100,101", duration: 550, category: "Sweeps" },
  { id: 77, name: "Transition Ramp Down Long Sharp 2 - 100 to 0%", family: "Ramp Down Long Sharp", intensity: 0.8, group: "76,77,100,101", duration: 550, category: "Sweeps" },
  { id: 100, name: "Transition Ramp Down Long Sharp 1 - 50 to 0%", family: "Ramp Down Long Sharp", intensity: 0.5, group: "76,77,100,101", duration: 550, category: "Sweeps" },
  { id: 101, name: "Transition Ramp Down Long Sharp 2 - 50 to 0%", family: "Ramp Down Long Sharp", intensity: 0.4, group: "76,77,100,101", duration: 550, category: "Sweeps" },

  // Ramp Down Medium Sharp (78->79, 102->103)
  { id: 78, name: "Transition Ramp Down Medium Sharp 1 - 100 to 0%", family: "Ramp Down Med Sharp", intensity: 1.0, group: "78,79,102,103", duration: 380, category: "Sweeps" },
  { id: 79, name: "Transition Ramp Down Medium Sharp 2 - 100 to 0%", family: "Ramp Down Med Sharp", intensity: 0.8, group: "78,79,102,103", duration: 380, category: "Sweeps" },
  { id: 102, name: "Transition Ramp Down Medium Sharp 1 - 50 to 0%", family: "Ramp Down Med Sharp", intensity: 0.5, group: "78,79,102,103", duration: 380, category: "Sweeps" },
  { id: 103, name: "Transition Ramp Down Medium Sharp 2 - 50 to 0%", family: "Ramp Down Med Sharp", intensity: 0.4, group: "78,79,102,103", duration: 380, category: "Sweeps" },

  // Ramp Down Short Sharp (80->81, 104->105)
  { id: 80, name: "Transition Ramp Down Short Sharp 1 - 100 to 0%", family: "Ramp Down Short Sharp", intensity: 1.0, group: "80,81,104,105", duration: 220, category: "Sweeps" },
  { id: 81, name: "Transition Ramp Down Short Sharp 2 - 100 to 0%", family: "Ramp Down Short Sharp", intensity: 0.8, group: "80,81,104,105", duration: 220, category: "Sweeps" },
  { id: 104, name: "Transition Ramp Down Short Sharp 1 - 50 to 0%", family: "Ramp Down Short Sharp", intensity: 0.5, group: "80,81,104,105", duration: 220, category: "Sweeps" },
  { id: 105, name: "Transition Ramp Down Short Sharp 2 - 50 to 0%", family: "Ramp Down Short Sharp", intensity: 0.4, group: "80,81,104,105", duration: 220, category: "Sweeps" },

  // Ramp Up Long Smooth (82->83, 106->107)
  { id: 82, name: "Transition Ramp Up Long Smooth 1 - 0 to 100%", family: "Ramp Up Long Smooth", intensity: 1.0, group: "82,83,106,107", duration: 600, category: "Sweeps" },
  { id: 83, name: "Transition Ramp Up Long Smooth 2 - 0 to 100%", family: "Ramp Up Long Smooth", intensity: 0.8, group: "82,83,106,107", duration: 600, category: "Sweeps" },
  { id: 106, name: "Transition Ramp Up Long Smooth 1 - 0 to 50%", family: "Ramp Up Long Smooth", intensity: 0.5, group: "82,83,106,107", duration: 600, category: "Sweeps" },
  { id: 107, name: "Transition Ramp Up Long Smooth 2 - 0 to 50%", family: "Ramp Up Long Smooth", intensity: 0.4, group: "82,83,106,107", duration: 600, category: "Sweeps" },

  // Ramp Up Medium Smooth (84->85, 108->109)
  { id: 84, name: "Transition Ramp Up Medium Smooth 1 - 0 to 100%", family: "Ramp Up Med Smooth", intensity: 1.0, group: "84,85,108,109", duration: 400, category: "Sweeps" },
  { id: 85, name: "Transition Ramp Up Medium Smooth 2 - 0 to 100%", family: "Ramp Up Med Smooth", intensity: 0.8, group: "84,85,108,109", duration: 400, category: "Sweeps" },
  { id: 108, name: "Transition Ramp Up Medium Smooth 1 - 0 to 50%", family: "Ramp Up Med Smooth", intensity: 0.5, group: "84,85,108,109", duration: 400, category: "Sweeps" },
  { id: 109, name: "Transition Ramp Up Medium Smooth 2 - 0 to 50%", family: "Ramp Up Med Smooth", intensity: 0.4, group: "84,85,108,109", duration: 400, category: "Sweeps" },

  // Ramp Up Short Smooth (86->87, 110->111)
  { id: 86, name: "Transition Ramp Up Short Smooth 1 - 0 to 100%", family: "Ramp Up Short Smooth", intensity: 1.0, group: "86,87,110,111", duration: 250, category: "Sweeps" },
  { id: 87, name: "Transition Ramp Up Short Smooth 2 - 0 to 100%", family: "Ramp Up Short Smooth", intensity: 0.8, group: "86,87,110,111", duration: 250, category: "Sweeps" },
  { id: 110, name: "Transition Ramp Up Short Smooth 1 - 0 to 50%", family: "Ramp Up Short Smooth", intensity: 0.5, group: "86,87,110,111", duration: 250, category: "Sweeps" },
  { id: 111, name: "Transition Ramp Up Short Smooth 2 - 0 to 50%", family: "Ramp Up Short Smooth", intensity: 0.4, group: "86,87,110,111", duration: 250, category: "Sweeps" },

  // Ramp Up Long Sharp (88->89, 112->113)
  { id: 88, name: "Transition Ramp Up Long Sharp 1 - 0 to 100%", family: "Ramp Up Long Sharp", intensity: 1.0, group: "88,89,112,113", duration: 550, category: "Sweeps" },
  { id: 89, name: "Transition Ramp Up Long Sharp 2 - 0 to 100%", family: "Ramp Up Long Sharp", intensity: 0.8, group: "88,89,112,113", duration: 550, category: "Sweeps" },
  { id: 112, name: "Transition Ramp Up Long Sharp 1 - 0 to 50%", family: "Ramp Up Long Sharp", intensity: 0.5, group: "88,89,112,113", duration: 550, category: "Sweeps" },
  { id: 113, name: "Transition Ramp Up Long Sharp 2 - 0 to 50%", family: "Ramp Up Long Sharp", intensity: 0.4, group: "88,89,112,113", duration: 550, category: "Sweeps" },

  // Ramp Up Medium Sharp (90->91, 114->115)
  { id: 90, name: "Transition Ramp Up Medium Sharp 1 - 0 to 100%", family: "Ramp Up Med Sharp", intensity: 1.0, group: "90,91,114,115", duration: 380, category: "Sweeps" },
  { id: 91, name: "Transition Ramp Up Medium Sharp 2 - 0 to 100%", family: "Ramp Up Med Sharp", intensity: 0.8, group: "90,91,114,115", duration: 380, category: "Sweeps" },
  { id: 114, name: "Transition Ramp Up Medium Sharp 1 - 0 to 50%", family: "Ramp Up Med Sharp", intensity: 0.5, group: "90,91,114,115", duration: 380, category: "Sweeps" },
  { id: 115, name: "Transition Ramp Up Medium Sharp 2 - 0 to 50%", family: "Ramp Up Med Sharp", intensity: 0.4, group: "90,91,114,115", duration: 380, category: "Sweeps" },

  // Ramp Up Short Sharp (92->93, 116->117)
  { id: 92, name: "Transition Ramp Up Short Sharp 1 - 0 to 100%", family: "Ramp Up Short Sharp", intensity: 1.0, group: "92,93,116,117", duration: 220, category: "Sweeps" },
  { id: 93, name: "Transition Ramp Up Short Sharp 2 - 0 to 100%", family: "Ramp Up Short Sharp", intensity: 0.8, group: "92,93,116,117", duration: 220, category: "Sweeps" },
  { id: 116, name: "Transition Ramp Up Short Sharp 1 - 0 to 50%", family: "Ramp Up Short Sharp", intensity: 0.5, group: "92,93,116,117", duration: 220, category: "Sweeps" },
  { id: 117, name: "Transition Ramp Up Short Sharp 2 - 0 to 50%", family: "Ramp Up Short Sharp", intensity: 0.4, group: "92,93,116,117", duration: 220, category: "Sweeps" },

  // --- SPECIAL UTILITIES AND SMOOTH HUMS (118-123) ---
  { id: 118, name: "Long buzz for programmatic stopping - 100%", family: "Programmatic Stop", intensity: 1.0, group: "118", duration: 1500, category: "Special" },
  
  { id: 119, name: "Smooth Hum 1 (No kick or brake pulse) - 50%", family: "Smooth Hum (No Kick/Brake)", intensity: 0.5, group: "119->123", duration: 500, category: "Special" },
  { id: 120, name: "Smooth Hum 2 (No kick or brake pulse) - 40%", family: "Smooth Hum (No Kick/Brake)", intensity: 0.4, group: "119->123", duration: 500, category: "Special" },
  { id: 121, name: "Smooth Hum 3 (No kick or brake pulse) - 30%", family: "Smooth Hum (No Kick/Brake)", intensity: 0.3, group: "119->123", duration: 500, category: "Special" },
  { id: 122, name: "Smooth Hum 4 (No kick or brake pulse) - 20%", family: "Smooth Hum (No Kick/Brake)", intensity: 0.2, group: "119->123", duration: 500, category: "Special" },
  { id: 123, name: "Smooth Hum 5 (No kick or brake pulse) - 10%", family: "Smooth Hum (No Kick/Brake)", intensity: 0.1, group: "119->123", duration: 500, category: "Special" }
];

// Group presets by family for fast inspector parsing
export const PRESETS_BY_FAMILY = PRESETS.reduce((acc, p) => {
  if (!acc[p.family]) {
    acc[p.family] = [];
  }
  acc[p.family].push(p);
  return acc;
}, {});

// Export fully formed family catalog list to represent in left library side panel
export const FAMILIES = Object.keys(PRESETS_BY_FAMILY).map(name => {
  const members = PRESETS_BY_FAMILY[name];
  return {
    name,
    group: members[0].group,
    category: members[0].category,
    members: members.sort((a, b) => b.intensity - a.intensity) // Sort high power to low power
  };
});
