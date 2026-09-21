/**
 * High-Precision Tactical Canvas Engine
 * Manages layer rendering, pan, zoom, right-click GR inspection,
 * military unit symbols, Blue/Red territory polygons, and platoon pathing vectors.
 */

class TacticalCanvas {
  constructor(canvasElement, grEngine) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.grEngine = grEngine;

    // Viewport transform
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.isPanLocked = false;
    this.startX = 0;
    this.startY = 0;

    // Interaction states
    this.isDrawing = false;
    this.isAddUnitMode = false;
    this.draggedUnit = null;

    // Layer visibility flags
    this.layers = {
      baseMap: true,
      grid: true,
      roads: true,
      rivers: true,
      bridges: true,
      railways: true,
      ponds: true,
      hills: true,
      settlements: true,
      blueLand: true,
      redLand: true,
      units: true,
      pathingVector: true
    };

    // Cached map image
    this.mapImg = new Image();
    this.mapLoaded = false;
    this.extractedFeatures = null;

    // Pathing vector endpoints
    this.activePathVector = null;

    this.bindEvents();
  }

  loadMap(mapUrl) {
    this.mapLoaded = false;
    this.mapImg.onload = () => {
      this.mapLoaded = true;
      this.fitToScreen();
      this.render();
    };
    this.mapImg.src = mapUrl;
  }

  setExtractedFeatures(features) {
    this.extractedFeatures = features;
    this.render();
  }

  setActivePathVector(vectorResult) {
    this.activePathVector = vectorResult;
    this.render();
  }

  setDrawingMode(enabled) {
    this.isDrawing = enabled;
    if (enabled) {
      this.canvas.classList.add('drawing-mode');
    } else {
      this.canvas.classList.remove('drawing-mode');
    }
  }

  setAddUnitMode(enabled) {
    this.isAddUnitMode = enabled;
    if (enabled) {
      this.canvas.style.cursor = 'crosshair';
    } else {
      this.canvas.style.cursor = 'grab';
    }
  }

  fitToScreen() {
    const parent = this.canvas.parentElement;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.canvas.width = w;
    this.canvas.height = h;

    if (!this.mapLoaded) return;

    const scaleX = w / this.mapImg.naturalWidth;
    const scaleY = h / this.mapImg.naturalHeight;
    this.zoom = Math.min(scaleX, scaleY) * 0.95;

    this.panX = (w - this.mapImg.naturalWidth * this.zoom) / 2;
    this.panY = (h - this.mapImg.naturalHeight * this.zoom) / 2;
    this.updateZoomDisplay();
  }

  fitAndFix() {
    this.fitToScreen();
    this.isPanLocked = !this.isPanLocked;
    this.render();
    return this.isPanLocked;
  }

  zoomIn() {
    const parent = this.canvas.parentElement;
    const centerX = (parent ? parent.clientWidth : this.canvas.width) / 2;
    const centerY = (parent ? parent.clientHeight : this.canvas.height) / 2;
    const newZoom = Math.min(8.0, this.zoom * 1.25);

    this.panX = centerX - (centerX - this.panX) * (newZoom / this.zoom);
    this.panY = centerY - (centerY - this.panY) * (newZoom / this.zoom);
    this.zoom = newZoom;

    this.render();
    this.updateZoomDisplay();
  }

  zoomOut() {
    const parent = this.canvas.parentElement;
    const centerX = (parent ? parent.clientWidth : this.canvas.width) / 2;
    const centerY = (parent ? parent.clientHeight : this.canvas.height) / 2;
    const newZoom = Math.max(0.2, this.zoom * 0.8);

    this.panX = centerX - (centerX - this.panX) * (newZoom / this.zoom);
    this.panY = centerY - (centerY - this.panY) * (newZoom / this.zoom);
    this.zoom = newZoom;

    this.render();
    this.updateZoomDisplay();
  }

  updateZoomDisplay() {
    const pct = Math.round(this.zoom * 100);
    const elem = document.getElementById('zoom-level-text');
    if (elem) elem.textContent = `${pct}%`;
  }

  screenToMap(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (screenX - rect.left - this.panX) / this.zoom;
    const y = (screenY - rect.top - this.panY) / this.zoom;
    return [x, y];
  }

  mapToScreen(mapX, mapY) {
    const x = (mapX * this.zoom) + this.panX;
    const y = (mapY * this.zoom) + this.panY;
    return [x, y];
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.fitToScreen();
      this.render();
    });

    // Zoom on wheel
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const newZoom = Math.max(0.2, Math.min(8.0, this.zoom * zoomFactor));

      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;
      this.render();
      this.updateZoomDisplay();
    });

    // Mouse down: Pan or Drag unit
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left click
        const [mx, my] = this.screenToMap(e.clientX, e.clientY);

        // If in territory drawing mode
        if (this.isDrawing && window.app && window.app.territoryManager.drawingMode) {
          window.app.territoryManager.addPoint([Math.round(mx), Math.round(my)]);
          return;
        }

        // If in Add Unit mode
        if (this.isAddUnitMode && window.app && window.app.commanderPlanner) {
          window.app.commanderPlanner.executeAddUnitAt(mx, my);
          return;
        }

        // Check if clicking on an existing unit to select/drag
        if (window.app && window.app.commanderPlanner) {
          const clickedUnit = this.findUnitAt(mx, my);
          if (clickedUnit) {
            this.draggedUnit = clickedUnit;
            window.app.commanderPlanner.selectUnit(clickedUnit.id);
            return;
          }
        }

        // Otherwise standard pan (unless locked/fixed)
        if (this.isPanLocked) {
          return;
        }

        this.isPanning = true;
        this.startX = e.clientX - this.panX;
        this.startY = e.clientY - this.panY;
      }
    });

    // Mouse move: Live GR readout + Pan + Drag
    this.canvas.addEventListener('mousemove', (e) => {
      const [mx, my] = this.screenToMap(e.clientX, e.clientY);

      // Update footer live GR info
      if (window.app && window.app.updateCursorGR) {
        window.app.updateCursorGR(mx, my);
      }

      if (this.draggedUnit) {
        window.app.commanderPlanner.updateUnitPosition(this.draggedUnit.id, mx, my);
        return;
      }

      if (this.isPanning) {
        this.panX = e.clientX - this.startX;
        this.panY = e.clientY - this.startY;
        this.render();
      }
    });

    // Mouse leave: reset GR indicator
    this.canvas.addEventListener('mouseleave', () => {
      if (window.app && window.app.updateCursorGR) {
        window.app.updateCursorGR(-1, -1);
      }
    });

    // Mouse up
    window.addEventListener('mouseup', () => {
      this.isPanning = false;
      this.draggedUnit = null;
    });

    // Right click: Interactive GR inspection
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const [mx, my] = this.screenToMap(e.clientX, e.clientY);
      if (window.app && window.app.showGRInspection) {
        window.app.showGRInspection(mx, my, e.clientX, e.clientY);
      }
    });

    // Double click: Finish polygon drawing
    this.canvas.addEventListener('dblclick', () => {
      if (this.isDrawing && window.app && window.app.territoryManager) {
        window.app.territoryManager.finishDrawing();
      }
    });
  }

  findUnitAt(mapX, mapY) {
    if (!window.app || !window.app.commanderPlanner) return null;
    const units = window.app.commanderPlanner.units;
    const hitRadius = 24 / this.zoom;

    for (let i = units.length - 1; i >= 0; i--) {
      const u = units[i];
      const dist = Math.hypot(mapX - u.coords[0], mapY - u.coords[1]);
      if (dist <= hitRadius) return u;
    }
    return null;
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // 1. Base Map
    if (this.layers.baseMap && this.mapLoaded) {
      ctx.drawImage(this.mapImg, 0, 0);
    }

    // 2. Extracted Features
    if (this.extractedFeatures) {
      this.renderExtractedLayers(ctx);
    }

    // 3. Blue Land & Red Land Territories (Phases 3, 6, 7)
    this.renderTerritories(ctx);

    // 4. Platoon Pathing Vectors (Phase 4)
    if (this.layers.pathingVector && this.activePathVector) {
      this.renderPathVector(ctx);
    }

    // 5. Plotted Units (Phase 5)
    if (this.layers.units && window.app && window.app.commanderPlanner) {
      this.renderUnits(ctx);
    }

    // 6. Active Drawing Preview Points
    if (this.isDrawing && window.app && window.app.territoryManager.drawingMode) {
      this.renderDrawingPreview(ctx);
    }

    ctx.restore();
  }

  renderExtractedLayers(ctx) {
    const f = this.extractedFeatures.features;
    if (!f) return;

    // Roads (Metalled & Highways)
    if (this.layers.roads && f.roads) {
      f.roads.forEach(r => {
        if (!r.points || r.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(r.points[0][0], r.points[0][1]);
        for (let i = 1; i < r.points.length; i++) {
          ctx.lineTo(r.points[i][0], r.points[i][1]);
        }
        ctx.strokeStyle = r.type === 'highway' ? '#ef4444' : '#f59e0b';
        ctx.lineWidth = r.type === 'highway' ? 6 : 4;
        ctx.stroke();
      });
    }

    // Rivers
    if (this.layers.rivers && f.rivers) {
      f.rivers.forEach(rv => {
        if (!rv.polygon || rv.polygon.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(rv.polygon[0][0], rv.polygon[0][1]);
        for (let i = 1; i < rv.polygon.length; i++) {
          ctx.lineTo(rv.polygon[i][0], rv.polygon[i][1]);
        }
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 8;
        ctx.stroke();
      });
    }

    // Ponds
    if (this.layers.ponds && f.ponds) {
      f.ponds.forEach(p => {
        if (!p.polygon || p.polygon.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(p.polygon[0][0], p.polygon[0][1]);
        for (let i = 1; i < p.polygon.length; i++) {
          ctx.lineTo(p.polygon[i][0], p.polygon[i][1]);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.fill();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // Bridges
    if (this.layers.bridges && f.bridges) {
      f.bridges.forEach(b => {
        const [bx, by] = b.coords;
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, by, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BR', bx, by);
      });
    }

    // Hills & Spot Heights
    if (this.layers.hills && f.hills) {
      f.hills.forEach(h => {
        const [hx, hy] = h.coords;
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.moveTo(hx, hy - 10);
        ctx.lineTo(hx - 8, hy + 6);
        ctx.lineTo(hx + 8, hy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`△ ${h.elevation_m}m`, hx + 12, hy + 4);
      });
    }

    // Railways (Track with railroad cross-ties & station)
    if (this.layers.railways && f.railways) {
      f.railways.forEach(rail => {
        if (!rail.points || rail.points.length < 2) return;
        // Dark track bed
        ctx.beginPath();
        ctx.moveTo(rail.points[0][0], rail.points[0][1]);
        for (let i = 1; i < rail.points.length; i++) {
          ctx.lineTo(rail.points[i][0], rail.points[i][1]);
        }
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 5;
        ctx.stroke();

        // Dashed steel track
        ctx.beginPath();
        ctx.moveTo(rail.points[0][0], rail.points[0][1]);
        for (let i = 1; i < rail.points.length; i++) {
          ctx.lineTo(rail.points[i][0], rail.points[i][1]);
        }
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Railway station marker
        if (rail.station && rail.station.coords) {
          const [sx, sy] = rail.station.coords;
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(sx - 5, sy - 5, 10, 10);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(sx - 5, sy - 5, 10, 10);
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 9.5px monospace';
          ctx.fillText(`🚂 ${rail.station.name}`, sx + 8, sy + 3);
        }
      });
    }

    // Settlements (Villages & Townships)
    if (this.layers.settlements && f.settlements) {
      f.settlements.forEach(s => {
        const [sx, sy] = s.coords;
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#064e3b';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#f1f5f9';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(s.name, sx + 6, sy + 3);
      });
    }
  }

  renderTerritories(ctx) {
    if (!window.app || !window.app.territoryManager) return;
    const tm = window.app.territoryManager;

    // Blue Land (Friendly)
    if (this.layers.blueLand && tm.blueLand.polygon.length > 2) {
      ctx.beginPath();
      const pts = tm.blueLand.polygon;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = tm.blueLand.color;
      ctx.fill();
      ctx.strokeStyle = tm.blueLand.borderColor;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Red Land (Hostile)
    if (this.layers.redLand && tm.redLand.polygon.length > 2) {
      ctx.beginPath();
      const pts = tm.redLand.polygon;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = tm.redLand.color;
      ctx.fill();
      ctx.strokeStyle = tm.redLand.borderColor;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  renderDrawingPreview(ctx) {
    const pts = window.app.territoryManager.activeDrawingPoints;
    if (pts.length === 0) return;

    const mode = window.app.territoryManager.drawingMode;
    const color = (mode === 'blue') ? '#38bdf8' : '#f43f5e';

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    pts.forEach(p => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  renderPathVector(ctx) {
    const v = this.activePathVector;
    if (!v || !v.origin || !v.destination) return;

    const [x1, y1] = v.origin.coords;
    const [x2, y2] = v.destination.coords;

    // Glowing dashed tactical vector line
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#00ff9d';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Vector Direction Arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowHeadLen = 14;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - arrowHeadLen * Math.cos(angle - Math.PI / 6), y2 - arrowHeadLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - arrowHeadLen * Math.cos(angle + Math.PI / 6), y2 - arrowHeadLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = '#00ff9d';
    ctx.fill();

    // Callout Label at midpoint
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const label = `${v.distanceKm} km | ${v.bearingDeg}° (${v.bearingMils} mils)`;

    ctx.font = 'bold 12px monospace';
    const textW = ctx.measureText(label).width;

    ctx.fillStyle = 'rgba(13, 21, 34, 0.9)';
    ctx.strokeStyle = '#00ff9d';
    ctx.lineWidth = 1;
    ctx.fillRect(midX - textW / 2 - 8, midY - 14, textW + 16, 22);
    ctx.strokeRect(midX - textW / 2 - 8, midY - 14, textW + 16, 22);

    ctx.fillStyle = '#00ff9d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, midX, midY - 3);

    ctx.restore();
  }

  renderUnits(ctx) {
    const units = window.app.commanderPlanner.units;
    const selectedId = window.app.commanderPlanner.selectedUnitId;

    units.forEach(u => {
      const [ux, uy] = u.coords;
      const isSelected = (u.id === selectedId);

      // Selection pulse ring
      if (isSelected) {
        ctx.strokeStyle = '#00ff9d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ux, uy, 24, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (u.type === 'attack_vector') {
        // Render Red Attack Arrow
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(ux - 20, uy + 20);
        ctx.lineTo(ux + 20, uy - 20);
        ctx.stroke();

        // Arrow head
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(ux + 20, uy - 20);
        ctx.lineTo(ux + 8, uy - 20);
        ctx.lineTo(ux + 20, uy - 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Name
        ctx.font = 'bold 9.5px monospace';
        const nameW = ctx.measureText(u.name).width;
        ctx.fillStyle = 'rgba(10, 15, 24, 0.85)';
        ctx.fillRect(ux - nameW / 2 - 3, uy + 12, nameW + 6, 13);
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.fillText(u.name, ux, uy + 22);

      } else if (u.type === 'op_post') {
        // Green Observation Post circle
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(ux, uy, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(ux, uy, 4, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.font = 'bold 9.5px monospace';
        const nameW = ctx.measureText(u.name).width;
        ctx.fillStyle = 'rgba(10, 15, 24, 0.85)';
        ctx.fillRect(ux - nameW / 2 - 3, uy + 14, nameW + 6, 13);
        ctx.fillStyle = '#10b981';
        ctx.textAlign = 'center';
        ctx.fillText(u.name, ux, uy + 24);

      } else if (u.type === 'bridge_pos') {
        // Yellow Bridge Marker
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(ux - 12, uy - 8, 24, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BRG', ux, uy);

        // Label
        ctx.font = 'bold 9.5px monospace';
        const nameW = ctx.measureText(u.name).width;
        ctx.fillStyle = 'rgba(10, 15, 24, 0.85)';
        ctx.fillRect(ux - nameW / 2 - 3, uy + 12, nameW + 6, 13);
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(u.name, ux, uy + 22);

      } else if (u.type === 'enemy_pos' || u.allegiance === 'hostile') {
        // Red Diamond Hostile Symbol
        ctx.save();
        ctx.translate(ux, uy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(-11, -11, 22, 22);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(-11, -11, 22, 22);
        ctx.restore();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ENY', ux, uy);

        // Label
        ctx.font = 'bold 9.5px monospace';
        const nameW = ctx.measureText(u.name).width;
        ctx.fillStyle = 'rgba(10, 15, 24, 0.85)';
        ctx.fillRect(ux - nameW / 2 - 3, uy + 14, nameW + 6, 13);
        ctx.fillStyle = '#ef4444';
        ctx.fillText(u.name, ux, uy + 24);

      } else {
        // Standard Friendly Blue HQ / Platoon Box
        const boxW = 32;
        const boxH = 20;
        const x = ux - boxW / 2;
        const y = uy - boxH / 2;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x, y, boxW, boxH);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, boxW, boxH);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(u.symbol.slice(0, 4), ux, uy);

        // Name
        ctx.font = 'bold 9.5px monospace';
        const nameW = ctx.measureText(u.name).width;
        ctx.fillStyle = 'rgba(10, 15, 24, 0.85)';
        ctx.fillRect(ux - nameW / 2 - 3, uy + 13, nameW + 6, 13);
        ctx.fillStyle = '#f1f5f9';
        ctx.fillText(u.name, ux, uy + 23);
      }
    });

    // Render Mini-Map Overview PIP
    this.renderMiniMap();
  }

  renderMiniMap() {
    const miniCanvas = document.getElementById('minimap-canvas');
    if (!miniCanvas || !this.mapLoaded) return;

    const mctx = miniCanvas.getContext('2d');
    const mw = miniCanvas.width = miniCanvas.clientWidth;
    const mh = miniCanvas.height = miniCanvas.clientHeight;

    mctx.clearRect(0, 0, mw, mh);
    mctx.drawImage(this.mapImg, 0, 0, mw, mh);

    // Compute current viewport frustum on mini-map
    const scaleX = mw / this.mapImg.naturalWidth;
    const scaleY = mh / this.mapImg.naturalHeight;

    const [vx1, vy1] = this.screenToMap(0, 0);
    const [vx2, vy2] = this.screenToMap(this.canvas.width, this.canvas.height);

    const rx = Math.max(0, vx1 * scaleX);
    const ry = Math.max(0, vy1 * scaleY);
    const rw = Math.min(mw - rx, (vx2 - vx1) * scaleX);
    const rh = Math.min(mh - ry, (vy2 - vy1) * scaleY);

    mctx.strokeStyle = '#ef4444';
    mctx.lineWidth = 2;
    mctx.strokeRect(rx, ry, rw, rh);
    mctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    mctx.fillRect(rx, ry, rw, rh);
  }

  exportToImage() {
    return this.canvas.toDataURL('image/png');
  }
}

window.TacticalCanvas = TacticalCanvas;
