/**
 * Platoon Pathing & Distance Math Engine (Phase 4)
 * Calculates:
 * - Direct distance in Kilometres, Metres, and Yards
 * - Grid Azimuth / Bearing in Degrees and Military Mils (NATO 6400 mils)
 * - Movement time estimations across terrain and tactical modes
 * - Dynamic Pairwise Distance Matrix between all plotted commander units
 */

class TacticalPathingMath {
  constructor(grEngine) {
    this.grEngine = grEngine;
  }

  calculateDirectVector(u1, u2) {
    if (!u1 || !u2) return null;

    const p1 = u1.coords;
    const p2 = u2.coords;

    const g1 = this.grEngine.pixelToGrid(p1[0], p1[1]);
    const g2 = this.grEngine.pixelToGrid(p2[0], p2[1]);

    const deltaE = (g2.eastingKm - g1.eastingKm) * 1000.0;
    const deltaN = (g2.northingKm - g1.northingKm) * 1000.0;

    const groundDistM = Math.hypot(deltaE, deltaN);
    const groundDistKm = groundDistM / 1000.0;

    // Azimuth / Bearing in degrees clockwise from Grid North
    let bearingRad = Math.atan2(deltaE, deltaN);
    let bearingDeg = (bearingRad * (180.0 / Math.PI) + 360.0) % 360.0;
    let bearingMils = Math.round((bearingDeg / 360.0) * 6400.0);

    let backBearingDeg = (bearingDeg + 180.0) % 360.0;
    let backBearingMils = Math.round((backBearingDeg / 360.0) * 6400.0);

    // Elevation delta
    const el1 = u1.elevation || 180;
    const el2 = u2.elevation || 185;
    const deltaEl = el2 - el1;
    const slantDistM = Math.hypot(groundDistM, deltaEl);

    // Transit times
    const footHours = (groundDistKm / 4.0);
    const quickHours = (groundDistKm / 6.0);
    const armCcHours = (groundDistKm / 22.0);
    const armRoadHours = (groundDistKm / 45.0);

    return {
      origin: u1,
      destination: u2,
      distanceMeters: Math.round(groundDistM),
      distanceKm: Number(groundDistKm.toFixed(2)),
      distanceYards: Math.round(groundDistM * 1.09361),
      slantDistanceMeters: Math.round(slantDistM),
      bearingDeg: Number(bearingDeg.toFixed(1)),
      bearingMils: bearingMils,
      backBearingDeg: Number(backBearingDeg.toFixed(1)),
      backBearingMils: backBearingMils,
      elevationDelta: deltaEl,
      travelTimes: {
        footPatrol: this.formatTime(footHours),
        quickMarch: this.formatTime(quickHours),
        armoredCC: this.formatTime(armCcHours),
        armoredRoad: this.formatTime(armRoadHours)
      }
    };
  }

  formatTime(hours) {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${m} mins`;
  }

  computeDistanceMatrix(units) {
    if (!units || units.length < 2) return null;

    const matrix = [];
    for (let i = 0; i < units.length; i++) {
      const row = { unit: units[i], distances: [] };
      for (let j = 0; j < units.length; j++) {
        if (i === j) {
          row.distances.push({ target: units[j], distanceKm: 0, bearingMils: 0 });
        } else {
          const res = this.calculateDirectVector(units[i], units[j]);
          row.distances.push({
            target: units[j],
            distanceKm: res.distanceKm,
            distanceM: res.distanceMeters,
            bearingMils: res.bearingMils
          });
        }
      }
      matrix.push(row);
    }
    return matrix;
  }
}

window.TacticalPathingMath = TacticalPathingMath;
