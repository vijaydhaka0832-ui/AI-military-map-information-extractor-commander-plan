/**
 * Military Grid Reference (GR) Client Engine
 * Real-time conversion between screen/pixel coordinates and
 * 6-figure and 8-figure Military Grid References (MGRS).
 * Supports explicit grid bounds calibration for scanned military maps.
 */

class ClientGREngine {
  constructor(calibration = {}) {
    this.utmZone = calibration.utm_zone || "45R";
    this.scaleRatio = calibration.scale_ratio || 50000;
    this.gridOriginEasting = calibration.grid_origin_easting || 64.0;
    this.gridOriginNorthing = calibration.grid_origin_northing || 91.0;
    this.gridExtentKm = calibration.grid_extent_km || 10.0;
    this.mapWidthPx = calibration.map_width_px || 1024;
    this.mapHeightPx = calibration.map_height_px || 689;
    this.marginPx = calibration.margin_px || 67;

    this.gridBounds = calibration.grid_bounds || {
      x_min: 64.0, x_max: 832.0,
      y_min: 53.0, y_max: 617.0,
      e_min: 64.0, e_max: 74.0,
      n_min: 91.0, n_max: 98.0
    };

    // Exact physical grid lines on Indian Military Topographical Map (UTM 45R)
    this.eastingTicks = calibration.easting_ticks || [
      [64, 64.0], [65, 140.0], [66, 215.0], [67, 295.0], [68, 374.0],
      [69, 450.0], [70, 529.0], [71, 605.0], [72, 682.0], [73, 760.0], [74, 832.0]
    ];
    this.northingTicks = calibration.northing_ticks || [
      [91, 617.0], [92, 540.0], [93, 460.0], [94, 378.0], [95, 299.0],
      [96, 218.0], [97, 137.0], [98, 53.0]
    ];

    this.recompute();
  }

  recompute() {
    if (this.gridBounds) {
      const b = this.gridBounds;
      const dx = Math.max(1, b.x_max - b.x_min);
      const dy = Math.max(1, b.y_max - b.y_min);
      const de = (b.e_max - b.e_min) * 1000.0;
      const dn = (b.n_max - b.n_min) * 1000.0;
      this.metersPerPixel = ((de / dx) + (dn / dy)) / 2.0;
      this.gridOriginEasting = b.e_min;
      this.gridOriginNorthing = b.n_min;
      this.gridExtentKm = b.e_max - b.e_min;
    } else {
      this.innerWidth = Math.max(100, this.mapWidthPx - (2 * this.marginPx));
      this.innerHeight = Math.max(100, this.mapHeightPx - (2 * this.marginPx));
      this.metersPerPixel = (this.gridExtentKm * 1000.0) / this.innerWidth;
    }
  }

  update(params) {
    Object.assign(this, params);
    this.recompute();
  }

  pixelToGrid(px, py) {
    let eastingKm = this.gridOriginEasting;
    let northingKm = this.gridOriginNorthing;

    // 1. READ RIGHT: Easting (West to East)
    if (this.eastingTicks && this.eastingTicks.length >= 2) {
      const et = this.eastingTicks;
      if (px <= et[0][1]) {
        const dxPerKm = et[1][1] - et[0][1];
        eastingKm = et[0][0] + ((px - et[0][1]) / dxPerKm);
      } else if (px >= et[et.length - 1][1]) {
        const dxPerKm = et[et.length - 1][1] - et[et.length - 2][1];
        eastingKm = et[et.length - 1][0] + ((px - et[et.length - 1][1]) / dxPerKm);
      } else {
        for (let i = 0; i < et.length - 1; i++) {
          const [e1, x1] = et[i];
          const [e2, x2] = et[i + 1];
          if (x1 <= px && px <= x2) {
            const frac = (px - x1) / (x2 - x1);
            eastingKm = e1 + frac * (e2 - e1);
            break;
          }
        }
      }
    } else if (this.gridBounds) {
      const b = this.gridBounds;
      const normX = (px - b.x_min) / (b.x_max - b.x_min);
      eastingKm = b.e_min + (normX * (b.e_max - b.e_min));
    } else {
      const relX = px - this.marginPx;
      const normX = relX / this.innerWidth;
      eastingKm = this.gridOriginEasting + (normX * this.gridExtentKm);
    }

    // 2. THEN UP: Northing (South to North)
    if (this.northingTicks && this.northingTicks.length >= 2) {
      const nt = this.northingTicks;
      if (py >= nt[0][1]) {
        // Extrapolate south
        const dyPerKm = nt[0][1] - nt[1][1];
        northingKm = nt[0][0] - ((py - nt[0][1]) / dyPerKm);
      } else if (py <= nt[nt.length - 1][1]) {
        // Extrapolate north
        const dyPerKm = nt[nt.length - 2][1] - nt[nt.length - 1][1];
        northingKm = nt[nt.length - 1][0] + ((nt[nt.length - 1][1] - py) / dyPerKm);
      } else {
        for (let i = 0; i < nt.length - 1; i++) {
          const [n1, y1] = nt[i];      // e.g. [91, 617]
          const [n2, y2] = nt[i + 1];  // e.g. [92, 540]
          if (y2 <= py && py <= y1) {
            const frac = (y1 - py) / (y1 - y2);
            northingKm = n1 + frac * (n2 - n1);
            break;
          }
        }
      }
    } else if (this.gridBounds) {
      const b = this.gridBounds;
      const normY = (b.y_max - py) / (b.y_max - b.y_min);
      northingKm = b.n_min + (normY * (b.n_max - b.n_min));
    } else {
      const relY = py - this.marginPx;
      const normY = 1.0 - (relY / this.innerHeight);
      northingKm = this.gridOriginNorthing + (normY * this.gridExtentKm);
    }

    return { eastingKm, northingKm };
  }

  gridToPixel(eastingKm, northingKm) {
    let px = this.marginPx;
    let py = this.marginPx;

    // Easting to X
    if (this.eastingTicks && this.eastingTicks.length >= 2) {
      const et = this.eastingTicks;
      if (eastingKm <= et[0][0]) {
        const dxPerKm = et[1][1] - et[0][1];
        px = et[0][1] + ((eastingKm - et[0][0]) * dxPerKm);
      } else if (eastingKm >= et[et.length - 1][0]) {
        const dxPerKm = et[et.length - 1][1] - et[et.length - 2][1];
        px = et[et.length - 1][1] + ((eastingKm - et[et.length - 1][0]) * dxPerKm);
      } else {
        for (let i = 0; i < et.length - 1; i++) {
          const [e1, x1] = et[i];
          const [e2, x2] = et[i + 1];
          if (e1 <= eastingKm && eastingKm <= e2) {
            const frac = (eastingKm - e1) / (e2 - e1);
            px = x1 + frac * (x2 - x1);
            break;
          }
        }
      }
    } else if (this.gridBounds) {
      const b = this.gridBounds;
      const normX = (eastingKm - b.e_min) / (b.e_max - b.e_min);
      px = b.x_min + (normX * (b.x_max - b.x_min));
    } else {
      const normX = (eastingKm - this.gridOriginEasting) / this.gridExtentKm;
      px = this.marginPx + (normX * this.innerWidth);
    }

    // Northing to Y
    if (this.northingTicks && this.northingTicks.length >= 2) {
      const nt = this.northingTicks;
      if (northingKm <= nt[0][0]) {
        const dyPerKm = nt[0][1] - nt[1][1];
        py = nt[0][1] + ((nt[0][0] - northingKm) * dyPerKm);
      } else if (northingKm >= nt[nt.length - 1][0]) {
        const dyPerKm = nt[nt.length - 2][1] - nt[nt.length - 1][1];
        py = nt[nt.length - 1][1] - ((northingKm - nt[nt.length - 1][0]) * dyPerKm);
      } else {
        for (let i = 0; i < nt.length - 1; i++) {
          const [n1, y1] = nt[i];
          const [n2, y2] = nt[i + 1];
          if (n1 <= northingKm && northingKm <= n2) {
            const frac = (northingKm - n1) / (n2 - n1);
            py = y1 - frac * (y1 - y2);
            break;
          }
        }
      }
    } else if (this.gridBounds) {
      const b = this.gridBounds;
      const normY = (northingKm - b.n_min) / (b.n_max - b.n_min);
      py = b.y_max - (normY * (b.y_max - b.y_min));
    } else {
      const normY = (northingKm - this.gridOriginNorthing) / this.gridExtentKm;
      py = this.marginPx + ((1.0 - normY) * this.innerHeight);
    }

    return { px, py };
  }

  getGR(px, py) {
    const { eastingKm, northingKm } = this.pixelToGrid(px, py);

    const roundedE = Math.round(eastingKm * 1000000) / 1000000;
    const roundedN = Math.round(northingKm * 1000000) / 1000000;

    const eKmInt = Math.floor(roundedE);
    const nKmInt = Math.floor(roundedN);

    let eFracM = Math.round((roundedE - eKmInt) * 100000) / 100;
    let nFracM = Math.round((roundedN - nKmInt) * 100000) / 100;

    eFracM = Math.max(0, Math.min(999.9, eFracM));
    nFracM = Math.max(0, Math.min(999.9, nFracM));

    const eSquare = String(eKmInt % 100).padStart(2, '0');
    const nSquare = String(nKmInt % 100).padStart(2, '0');

    // Military Doctrine: READ RIGHT, THEN UP
    // 1. Easting: 3 digits (2-digit grid square + 1 digit tenths/100m)
    const eTenth = Math.max(0, Math.min(9, Math.floor((eFracM + 0.05) / 100.0)));
    const easting3 = `${eSquare}${eTenth}`;

    // 2. Northing: 3 digits (2-digit grid square + 1 digit tenths/100m)
    const nTenth = Math.max(0, Math.min(9, Math.floor((nFracM + 0.05) / 100.0)));
    const northing3 = `${nSquare}${nTenth}`;

    // Standard 6-Figure Military GR: 6 continuous digits (Easting 3 + Northing 3)
    const gr6 = `${easting3}${northing3}`;
    const gr6Spaced = `${easting3} ${northing3}`;

    // 8-Figure GR: 10m precision (2 digits per axis)
    const eHundredth = String(Math.max(0, Math.min(99, Math.floor((eFracM + 0.05) / 10.0)))).padStart(2, '0');
    const nHundredth = String(Math.max(0, Math.min(99, Math.floor((nFracM + 0.05) / 10.0)))).padStart(2, '0');
    const gr8 = `${eSquare}${eHundredth}${nSquare}${nHundredth}`;
    const gr8Spaced = `${eSquare}${eHundredth} ${nSquare}${nHundredth}`;

    return {
      gr6,
      gr6Spaced,
      easting3,
      northing3,
      eSquare,
      eTenth,
      nSquare,
      nTenth,
      gr8,
      gr8Spaced,
      eastingKm: eastingKm.toFixed(3),
      northingKm: northingKm.toFixed(3),
      utmZone: this.utmZone,
      scale: `1:${this.scaleRatio.toLocaleString()}`,
      metersPerPixel: this.metersPerPixel.toFixed(2)
    };
  }
}

window.ClientGREngine = ClientGREngine;
