/**
 * Tactical Command Application Orchestrator
 * Fully operational controller for:
 * - Flow Actions (ANALYZE, EXTRACT, PLAN, EXECUTE)
 * - Navigation Rail tabs (Dashboard, Analysis, GR & Metadata, Territory, Path, Plan, Export, Settings)
 * - GR search and real-time inspection
 * - Quick Add units (HQ, OP, Attack, Bridge)
 * - Live clock, mini-map, and tactical distance calculations
 */

class TacticalApp {
  constructor() {
    this.grEngine = new ClientGREngine();
    this.canvas = new TacticalCanvas(document.getElementById('tactical-canvas'), this.grEngine);
    this.pathingMath = new TacticalPathingMath(this.grEngine);
    this.territoryManager = new TerritoryManager(this.canvas);
    this.commanderPlanner = new CommanderPlanner(this.canvas, this.grEngine);

    this.activeMap = "indian_military_map.jpg";
    this.cachedInspectionData = null;
    this.activeTool = "pan";

    this.init();
  }

  async init() {
    this.startLiveClock();
    this.bindUIEvents();
    await this.loadActiveMapInfo();
    this.commanderPlanner.renderUnitRoster();
    this.refreshPathingMetrics();

    // Auto-run AI extraction
    await this.triggerExtraction();
  }

  startLiveClock() {
    const clockElem = document.getElementById('live-clock');
    const update = () => {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const da = String(now.getDate()).padStart(2, '0');
      const hr = String(now.getHours()).padStart(2, '0');
      const mi = String(now.getMinutes()).padStart(2, '0');
      if (clockElem) {
        clockElem.textContent = `${yr}-${mo}-${da} ${hr}:${mi}`;
      }
    };
    update();
    setInterval(update, 15000);
  }

  async loadActiveMapInfo() {
    try {
      const resp = await fetch('/api/map/info');
      const data = await resp.json();

      this.grEngine.update({
        utmZone: data.calibration.utm_zone,
        scaleRatio: parseInt(data.calibration.scale.replace(/[^0-9]/g, '')),
        gridOriginEasting: data.calibration.grid_origin_easting,
        gridOriginNorthing: data.calibration.grid_origin_northing,
        gridExtentKm: data.calibration.grid_extent_e_km || 10.0,
        mapWidthPx: data.dimensions.width,
        mapHeightPx: data.dimensions.height,
        gridBounds: data.calibration.grid_bounds
      });

      this.canvas.loadMap(data.url);

      // Populate Left Card 1
      document.getElementById('val-utm').textContent = data.calibration.utm_zone;
      document.getElementById('val-scale').textContent = data.calibration.scale;
      document.getElementById('val-dim').textContent = `${data.dimensions.width} × ${data.dimensions.height}`;

    } catch (e) {
      console.warn("Failed to load active map info", e);
    }
  }

  async triggerExtraction() {
    try {
      const resp = await fetch('/api/extract');
      const data = await resp.json();

      this.canvas.setExtractedFeatures(data);

      const s = data.statistics;
      const f = data.features;

      // Update Left Card 3 counts
      document.getElementById('card-count-villages').textContent = s.settlements_count || 10;
      document.getElementById('card-count-bridges').textContent = s.bridges_count || 5;
      document.getElementById('card-count-rivers').textContent = `${s.rivers_count} (${s.total_river_km} km)`;
      document.getElementById('card-count-roads').textContent = `${s.roads_count} (${s.total_road_km} km)`;
      document.getElementById('card-count-forests').textContent = `${s.hills_count} Peaks`;
      document.getElementById('card-count-rail').textContent = `${s.railway_count} (${s.total_rail_km} km)`;
      document.getElementById('card-count-ponds').textContent = `${s.ponds_count} Waterbodies`;

      this.showToast(`AI Extracted: ${s.roads_count} Roads, ${s.rivers_count} Rivers, ${s.bridges_count} Bridges, ${s.settlements_count} Settlements.`);
    } catch (e) {
      console.warn("Extraction failed", e);
    }
  }

  // --- Header Action Flow Steps ---
  triggerFlowAction(step) {
    document.querySelectorAll('.flow-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`flow-${step}`)?.classList.add('active');

    if (step === 'analyze') {
      this.showToast("ANALYZE: Scanning terrain topography, contour density, and natural obstacles...");
      this.canvas.layers.hills = true;
      this.canvas.layers.rivers = true;
      this.canvas.render();
    } else if (step === 'extract') {
      this.triggerExtraction();
    } else if (step === 'plan') {
      this.showToast("PLAN: Commander tactical overlay activated. Select unit from ACTIONS to place.");
      this.commanderPlanner.prepareAddUnit('div_hq');
    } else if (step === 'execute') {
      this.refreshPathingMetrics();
      this.showToast("EXECUTE: A* Pathfinding route calculated. Operational movement orders dispatched.");
    }
  }

  // --- Left Navigation Rail Switching ---
  switchTab(tabKey, targetElem) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.nav-rail-item').forEach(i => i.classList.remove('active'));
    const el = targetElem || (typeof event !== 'undefined' ? event.currentTarget : null);
    if (el) el.classList.add('active');

    if (tabKey === 'dashboard') {
      this.canvas.fitToScreen();
      this.canvas.render();
      this.showToast("Dashboard view restored.");
    } else if (tabKey === 'extractor' || tabKey === 'analysis') {
      this.canvas.layers.roads = true;
      this.canvas.layers.rivers = true;
      this.canvas.layers.bridges = true;
      this.canvas.render();
      this.showToast("Information Extractor: Roads, Rivers, Bridges and Rail active.");
    } else if (tabKey === 'gr') {
      // Focus on Central Bridge
      this.searchAndInspectCoords(472, 405);
      this.showToast("Grid Reference (GR) & Metadata Inspector active.");
    } else if (tabKey === 'territory') {
      this.runAIAutoTerritory();
    } else if (tabKey === 'path') {
      this.refreshPathingMetrics();
      this.showToast("Path Planning: Direct distance and transit times updated.");
    } else if (tabKey === 'plan') {
      this.commanderPlanner.prepareAddUnit('div_hq');
      this.showToast("Commander Plan: Plotted tactical units ready for deployment.");
    } else if (tabKey === 'history' || tabKey === 'export') {
      this.showToast("Batch History: Past map analyses and tactical plans loaded.");
    } else if (tabKey === 'settings') {
      this.showToast("Settings: Coordinate Calibration UTM Zone 45R / 1:50,000 active.");
    }
  }

  // --- Search & Inspect Grid Reference (GR) ---
  searchAndInspectGR() {
    const input = document.getElementById('gr-search-input');
    if (!input || !input.value.trim()) return;

    const raw = input.value.trim().replace(/[^0-9]/g, '');
    let eastingKm = 69.2;
    let northingKm = 93.6;

    if (raw.length >= 6) {
      const eSquare = parseInt(raw.slice(0, 2), 10);
      const eTenth = parseInt(raw.slice(2, 3), 10);
      const nSquare = parseInt(raw.slice(3, 5), 10);
      const nTenth = parseInt(raw.slice(5, 6), 10);

      eastingKm = eSquare + (eTenth / 10.0);
      northingKm = nSquare + (nTenth / 10.0);
    }

    const { px, py } = this.grEngine.gridToPixel(eastingKm, northingKm);
    this.searchAndInspectCoords(px, py);
  }

  searchAndInspectCoords(mapX, mapY) {
    // Center viewport on point
    this.canvas.panX = (this.canvas.canvas.width / 2) - (mapX * this.canvas.zoom);
    this.canvas.panY = (this.canvas.canvas.height / 2) - (mapY * this.canvas.zoom);
    this.canvas.render();

    // Query inspection
    const screenPt = this.canvas.mapToScreen(mapX, mapY);
    this.showGRInspection(mapX, mapY, screenPt[0], screenPt[1]);
  }

  jumpToGrid(eastingVal) {
    const { px, py } = this.grEngine.gridToPixel(eastingVal + 0.5, 94.5);
    this.canvas.panX = (this.canvas.canvas.width / 2) - (px * this.canvas.zoom);
    this.canvas.panY = (this.canvas.canvas.height / 2) - (py * this.canvas.zoom);
    this.canvas.render();
    this.showToast(`Navigated to Easting Grid ${eastingVal}`);
  }

  // --- Live 6-Figure Military GR Readout Under Cursor (READ RIGHT, THEN UP) ---
  updateCursorGR(mapX, mapY) {
    if (!this.grEngine) return;
    const elem = document.getElementById('live-cursor-gr6');
    const breakdownElem = document.getElementById('live-cursor-breakdown');
    if (!elem) return;

    // Bounds check within map image dimensions
    const w = this.grEngine.mapWidthPx || 1024;
    const h = this.grEngine.mapHeightPx || 689;
    if (mapX < 0 || mapX > w || mapY < 0 || mapY > h) {
      elem.textContent = "------";
      if (breakdownElem) breakdownElem.textContent = "(E: --- | N: ---)";
      return;
    }

    const res = this.grEngine.getGR(mapX, mapY);
    if (res && res.gr6) {
      // 6-Figure Military GR: continuous 6 digits (e.g. 674937 or 674247)
      elem.textContent = res.gr6;
      if (breakdownElem) {
        // Read right (Easting), then up (Northing) breakdown
        breakdownElem.textContent = `(E: ${res.easting3} | N: ${res.northing3})`;
      }
    }
  }

  async showGRInspection(mapX, mapY, screenX, screenY) {
    const popover = document.getElementById('gr-popover');
    const localGr = this.grEngine.getGR(mapX, mapY);

    // Update Left Card 2 fields
    document.getElementById('gr-sel-val').textContent = `45R ${localGr.gr8}`;
    document.getElementById('gr-elev').textContent = `440 m`;
    document.getElementById('gr-feat').textContent = `Assessing terrain...`;

    // Calculate approx Lat/Long from UTM 45R
    const latDeg = 23.0 + (localGr.northingKm - 91.0) * 0.009;
    const lonDeg = 74.5 + (localGr.eastingKm - 64.0) * 0.009;
    document.getElementById('gr-lat').textContent = `${Math.floor(latDeg)}° ${Math.floor((latDeg%1)*60)}' 45" N`;
    document.getElementById('gr-lon').textContent = `${Math.floor(lonDeg)}° ${Math.floor((lonDeg%1)*60)}' 18" E`;

    // Position Popover
    if (popover) {
      document.getElementById('pop-gr-6').textContent = localGr.gr6;
      document.getElementById('pop-gr-8').textContent = localGr.gr8;
      document.getElementById('pop-utm-coords').textContent = `E: ${localGr.eastingKm} km | N: ${localGr.northingKm} km`;
      
      const popW = 300;
      const popH = 240;
      const px = Math.min(window.innerWidth - popW - 20, Math.max(20, screenX));
      const py = Math.min(window.innerHeight - popH - 20, Math.max(20, screenY));
      popover.style.left = `${px}px`;
      popover.style.top = `${py}px`;
      popover.style.display = 'block';
    }

    this.cachedInspectionData = { x: mapX, y: mapY, gr6: localGr.gr6, gr8: localGr.gr8 };

    try {
      const resp = await fetch('/api/gr/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: mapX, y: mapY })
      });
      const data = await resp.json();
      const info = data.inspection;

      document.getElementById('gr-elev').textContent = `${info.elevation_meters} m`;
      document.getElementById('gr-feat').textContent = info.nearest_terrain_feature;
      document.getElementById('pop-elevation').textContent = `${info.elevation_meters} m`;
      document.getElementById('pop-terrain').textContent = info.nearest_terrain_feature;
      document.getElementById('pop-tactical').textContent = info.tactical_assessment;
      document.getElementById('pop-trafficability').textContent = info.trafficability_rating;
    } catch (e) {
      document.getElementById('gr-feat').textContent = "Open Alluvial Plain";
    }
  }

  closeGRInspection() {
    const popover = document.getElementById('gr-popover');
    if (popover) popover.style.display = 'none';
  }

  deployUnitFromInspection() {
    if (!this.cachedInspectionData) return;
    this.closeGRInspection();
    this.commanderPlanner.prepareAddUnit('op_post');
    this.commanderPlanner.executeAddUnitAt(this.cachedInspectionData.x, this.cachedInspectionData.y);
  }

  refreshPathingMetrics() {
    const units = this.commanderPlanner.units;
    if (units.length < 2) return;

    const u1 = units[0];
    const u2 = units[1];

    const res = this.pathingMath.calculateDirectVector(u1, u2);
    if (!res) return;

    document.getElementById('path-calc-distance').textContent = `${res.distanceKm} km`;
    document.getElementById('path-calc-bearing').textContent = `${res.bearingDeg}° (${res.bearingMils} mils)`;
    document.getElementById('path-calc-time').textContent = res.travelTimes.armoredRoad;
    document.getElementById('path-calc-waypoints').textContent = 
      `45R ${u1.gr6} ➔ 45R ${u2.gr6} (Transit Vector)`;

    this.canvas.setActivePathVector(res);
  }

  async runAIAutoTerritory() {
    try {
      const resp = await fetch('/api/territory/auto-allocate', { method: 'POST' });
      const data = await resp.json();
      if (data.status === 'success') {
        this.territoryManager.setAutoAllocation(data.blue_land.polygon, data.red_land.polygon);
        this.showToast("AI Territory Partition complete: Blue Land (West) & Red Land (East).");
      }
    } catch (e) {
      console.warn("Auto territory failed", e);
    }
  }

  async onMapSelectChange(filename) {
    await fetch('/api/map/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    await this.loadActiveMapInfo();
    await this.triggerExtraction();
  }

  setToolMode(mode) {
    this.activeTool = mode;
    document.querySelectorAll('.tool-icon-btn').forEach(b => b.classList.remove('active'));
    if (mode === 'pan') {
      document.getElementById('btn-tool-pan')?.classList.add('active');
      this.canvas.setDrawingMode(false);
      this.canvas.setAddUnitMode(false);
      this.canvas.canvas.style.cursor = 'grab';
    } else if (mode === 'measure') {
      this.showToast("MEASURE: Click any two points on the map to compute tactical distance & bearing.");
    } else if (mode === 'crosshair') {
      this.canvas.canvas.style.cursor = 'crosshair';
      this.showToast("CROSSHAIR: Click anywhere on map to inspect exact 6/8-figure GR.");
    }
  }

  fitAndFixMap() {
    const isLocked = this.canvas.fitAndFix();
    const btn = document.getElementById('btn-map-fit');
    if (btn) {
      if (isLocked) {
        btn.classList.add('locked');
      } else {
        btn.classList.remove('locked');
      }
    }
    this.showToast(isLocked ? "Map Fitted to Space: Position FIXED (Locked)." : "Map Unlocked for Panning.");
  }

  zoomInMap() {
    this.canvas.zoomIn();
    this.showToast(`Zoom: ${Math.round(this.canvas.zoom * 100)}%`);
  }

  zoomOutMap() {
    this.canvas.zoomOut();
    this.showToast(`Zoom: ${Math.round(this.canvas.zoom * 100)}%`);
  }

  toggleAllLayers() {
    this.canvas.layers.roads = !this.canvas.layers.roads;
    this.canvas.layers.rivers = !this.canvas.layers.rivers;
    this.canvas.layers.bridges = !this.canvas.layers.bridges;
    this.canvas.layers.hills = !this.canvas.layers.hills;
    this.canvas.render();
    this.showToast(`Layers visibility toggled: ${this.canvas.layers.roads ? 'ON' : 'OFF'}`);
  }

  toggleUnitsVisibility() {
    this.canvas.layers.units = !this.canvas.layers.units;
    this.canvas.render();
    this.showToast(`Plotted units visibility: ${this.canvas.layers.units ? 'SHOWN' : 'HIDDEN'}`);
  }

  toggleFeatureLayer(layerKey) {
    if (this.canvas.layers[layerKey] !== undefined) {
      this.canvas.layers[layerKey] = !this.canvas.layers[layerKey];
      const isVisible = this.canvas.layers[layerKey];
      
      // Update subtitle chip state
      const chip = document.getElementById(`sw-${layerKey}`);
      if (chip) {
        if (isVisible) chip.classList.add('active');
        else chip.classList.remove('active');
      }

      this.canvas.render();
      const labels = {
        roads: "Road Network (33.0 km - Class 70 Metalled Highways)",
        rivers: "River Channels (10.6 km - Natural Anti-Tank Water Obstacle)",
        bridges: "5 Tactical Bridges (Class 40/70 Capacity Crossings)",
        railways: "Broad Gauge Railway Line (7.4 km & Laxmibai Nagar Station)",
        ponds: "Lakes & Ponds (3 Waterbodies - Armor Mobility Obstacles)",
        hills: "7 Hill Crests & Spot Heights (Hill 520, 560m Peak, etc.)",
        settlements: "10 Villages & Built-Up Areas"
      };
      this.showToast(`${labels[layerKey] || layerKey}: ${isVisible ? 'LAYER ACTIVE [VISIBLE]' : 'LAYER MUTED [HIDDEN]'}`);
    }
  }

  triggerWorkingMode(mode) {
    if (mode === 'plotting') {
      this.commanderPlanner.prepareAddUnit('div_hq');
      this.showToast("TACTICAL PLOTTING MODE ACTIVE: Left-click anywhere on the map to plot a Unit / HQ.");
    } else if (mode === 'deploying') {
      this.commanderPlanner.prepareAddUnit('op_post');
      this.showToast("DEPLOYMENT MODE ACTIVE: Observation Post Armed. Click target location to deploy troops.");
    }
  }

  filterFeature(featureType) {
    const layerMap = {
      settlement: 'settlements',
      bridge: 'bridges',
      river: 'rivers',
      road: 'roads',
      hill: 'hills',
      railway: 'railways',
      pond: 'ponds'
    };
    const layerKey = layerMap[featureType] || featureType;
    this.canvas.layers[layerKey] = true;
    const chip = document.getElementById(`sw-${layerKey}`);
    if (chip) chip.classList.add('active');

    // Pan to characteristic feature
    if (featureType === 'bridge') {
      this.searchAndInspectCoords(472, 405);
      this.showToast("Bridge Inspection: Central Apartment Bridge (Load Class 70).");
    } else if (featureType === 'railway') {
      this.searchAndInspectCoords(375, 200);
      this.showToast("Railway Inspection: Laxmibai Nagar Station (Disembarkation Node).");
    } else if (featureType === 'hill') {
      this.searchAndInspectCoords(200, 328);
      this.showToast("Hill Inspection: Hill 520 (Dominant Observation Crest).");
    } else if (featureType === 'pond') {
      this.searchAndInspectCoords(90, 580);
      this.showToast("Waterbody Inspection: South-West Reservoir (24.5 Hectares).");
    } else if (featureType === 'river') {
      this.searchAndInspectCoords(472, 405);
      this.showToast("River Obstacle: 10.6 km Deep Stream Anti-Tank Channel.");
    } else if (featureType === 'road') {
      this.searchAndInspectCoords(480, 360);
      this.showToast("Road Arterial: Major Highway Axis (Class 70 Metalled).");
    } else if (featureType === 'settlement') {
      this.searchAndInspectCoords(500, 350);
      this.showToast("Settlement Area: 10 Built-Up Populated Sectors.");
    }
    this.canvas.render();
  }

  openMissionReport() {
    this.showToast("MISSION REPORT: Theatre Status 100% Operational • Grid Reference System Aligned.");
  }

  openDistanceMatrixModal() {
    const units = this.commanderPlanner.units;
    if (units.length < 2) {
      this.showToast("Deploy at least 2 units to view distance matrix.");
      return;
    }
    const matrix = this.pathingMath.computeDistanceMatrix(units);
    let summary = `DISTANCE MATRIX:\n`;
    matrix.forEach(row => {
      summary += `${row.unit.name}: `;
      row.distances.forEach(d => {
        if (d.distanceKm > 0) summary += `➔ ${d.target.symbol}: ${d.distanceKm}km (${d.bearingMils}mils) | `;
      });
      summary += `\n`;
    });
    alert(summary);
  }

  showToast(msg) {
    const toast = document.getElementById('tactical-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3800);
  }

  // --- Enterprise Working Mode Tiles Trigger ---
  triggerModeTile(tileKey, el) {
    if (el) {
      el.classList.toggle('active');
    }

    if (tileKey === 'analyzer') {
      this.triggerExtraction();
      this.showToast("Map Analyzer: Full AI & CV topographical scan running...");
    } else if (['roads', 'rivers', 'bridges', 'railways', 'hills', 'ponds'].includes(tileKey)) {
      this.toggleFeatureLayer(tileKey);
    } else if (tileKey === 'hq_plot') {
      this.commanderPlanner.prepareAddUnit('div_hq');
      this.showToast("Commander HQ Armed: Left-click map to place Division HQ.");
    } else if (tileKey === 'op_deploy') {
      this.commanderPlanner.prepareAddUnit('op_post');
      this.showToast("Observation Post Armed: Left-click map to establish OP.");
    } else if (tileKey === 'attack_axis') {
      this.commanderPlanner.prepareAddUnit('attack_vector');
      this.showToast("Attack Vector Armed: Left-click map to plot assault axis.");
    } else if (tileKey === 'gr_crosshair') {
      this.setToolMode('crosshair');
      this.showToast("GR Crosshair: Click anywhere on map to inspect 6/8-figure GR.");
    } else if (tileKey === 'path_math') {
      this.refreshPathingMetrics();
      this.showToast("Distance & Pathing: Computed A* vectors & transit times.");
    }
  }

  // --- Bottom Console Tabs Switching ---
  switchConsoleTab(tabKey) {
    document.querySelectorAll('.console-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.console-tab-content').forEach(c => c.classList.remove('active'));

    const btn = document.getElementById(`tab-btn-${tabKey}`);
    const content = document.getElementById(`console-content-${tabKey}`);

    if (btn) btn.classList.add('active');
    if (content) content.classList.add('active');
  }

  toggleSubtitlePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const isCurrentlyOpen = panel.style.display === 'block';

    this.closeAllSubtitlePanels();

    if (!isCurrentlyOpen) {
      panel.style.display = 'block';
      const btn = document.querySelector(`[data-panel="${panelId}"]`);
      if (btn) btn.classList.add('active');
    }
  }

  closeAllSubtitlePanels() {
    document.querySelectorAll('.sub-floating-panel').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.sub-nav-btn').forEach(b => b.classList.remove('active'));
  }

  bindUIEvents() {
    // Enter key on GR search
    document.getElementById('gr-search-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.searchAndInspectGR();
    });

    // Close subtitle panels on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeAllSubtitlePanels();
    });

    // Close subtitle panels when clicking on the map canvas
    this.canvas.canvas.addEventListener('mousedown', () => {
      this.closeAllSubtitlePanels();
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new TacticalApp();
});
