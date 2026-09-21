/**
 * Territory & Boundary Mapping Engine (Phases 3, 6, 7)
 * Handles:
 * - Manual polygon drawing for Blue Land (Friendly) & Red Land (Enemy) decided by user
 * - Auto Land Allocation via AI barrier detection
 * - Vertex editing, area calculation, and boundary lines
 */

class TerritoryManager {
  constructor(canvasManager) {
    this.canvas = canvasManager;
    this.blueLand = {
      name: "Blue Land (Friendly Forces)",
      allegiance: "friendly",
      color: "rgba(56, 189, 248, 0.22)",
      borderColor: "#38bdf8",
      polygon: [] // Array of [x, y]
    };

    this.redLand = {
      name: "Red Land (Hostile Forces)",
      allegiance: "hostile",
      color: "rgba(244, 63, 94, 0.22)",
      borderColor: "#f43f5e",
      polygon: [] // Array of [x, y]
    };

    this.drawingMode = null; // 'blue' or 'red' or null
    this.activeDrawingPoints = [];
  }

  startDrawing(type) {
    this.drawingMode = type; // 'blue' or 'red'
    this.activeDrawingPoints = [];
    this.canvas.setDrawingMode(true);
    this.updateUIStatus();
  }

  addPoint(pt) {
    if (!this.drawingMode) return;
    this.activeDrawingPoints.push(pt);
    this.canvas.render();
  }

  finishDrawing() {
    if (!this.drawingMode || this.activeDrawingPoints.length < 3) {
      this.cancelDrawing();
      return;
    }

    if (this.drawingMode === 'blue') {
      this.blueLand.polygon = [...this.activeDrawingPoints];
    } else if (this.drawingMode === 'red') {
      this.redLand.polygon = [...this.activeDrawingPoints];
    }

    this.drawingMode = null;
    this.activeDrawingPoints = [];
    this.canvas.setDrawingMode(false);
    this.canvas.render();
    this.updateUIStatus();
  }

  cancelDrawing() {
    this.drawingMode = null;
    this.activeDrawingPoints = [];
    this.canvas.setDrawingMode(false);
    this.canvas.render();
    this.updateUIStatus();
  }

  clearTerritory(type) {
    if (type === 'blue') {
      this.blueLand.polygon = [];
    } else if (type === 'red') {
      this.redLand.polygon = [];
    }
    this.canvas.render();
    this.updateUIStatus();
  }

  setAutoAllocation(bluePoly, redPoly) {
    this.blueLand.polygon = bluePoly;
    this.redLand.polygon = redPoly;
    this.canvas.render();
    this.updateUIStatus();
  }

  calculateAreaSqKm(polygon, metersPerPixel) {
    if (!polygon || polygon.length < 3) return 0;
    // Shoelace formula in pixels
    let areaPx = 0;
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      areaPx += polygon[i][0] * polygon[j][1];
      areaPx -= polygon[j][0] * polygon[i][1];
    }
    areaPx = Math.abs(areaPx) / 2.0;
    const areaSqM = areaPx * (metersPerPixel * metersPerPixel);
    return Number((areaSqM / 1000000.0).toFixed(1));
  }

  updateUIStatus() {
    const indicator = document.getElementById('drawing-indicator');
    const blueCount = document.getElementById('blue-vertex-count');
    const redCount = document.getElementById('red-vertex-count');

    if (blueCount) blueCount.textContent = `${this.blueLand.polygon.length} pts`;
    if (redCount) redCount.textContent = `${this.redLand.polygon.length} pts`;

    if (indicator) {
      if (this.drawingMode) {
        indicator.style.display = 'block';
        indicator.textContent = `DRAWING ${this.drawingMode.toUpperCase()} LAND: Click on map to add boundary points. Double click or press "Finish Polygon" when complete.`;
      } else {
        indicator.style.display = 'none';
      }
    }
  }
}

window.TerritoryManager = TerritoryManager;
