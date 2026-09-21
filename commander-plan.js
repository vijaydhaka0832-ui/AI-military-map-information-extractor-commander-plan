/**
 * Commander Planner & Tactical Overlay Engine (Phase 5)
 * Options supported:
 * - ADD unit (+ Add HQ, + Add OP, + Add Attack, + Add Bridge)
 * - REMOVE unit
 * - CLEAR plan (Clear All)
 * - SAVE plan
 * - UPDATE plan
 * - EXPORT (JSON tactical mission format + High-Resolution PNG overlay)
 */

class CommanderPlanner {
  constructor(canvasManager, grEngine) {
    this.canvas = canvasManager;
    this.grEngine = grEngine;
    this.units = [];
    this.selectedUnitId = null;
    this.planName = "OPERATION TACTICAL SHIELD - SECTOR 45R";
    this.pendingAddUnitType = null;

    // Unit Template Catalog
    this.unitTypes = [
      { type: "div_hq", name: "HQ", symbol: "HQ", allegiance: "friendly", role: "Division Command Post", icon: "HQ", color: "#38bdf8" },
      { type: "op_post", name: "OP", symbol: "OP", allegiance: "friendly", role: "Observation Post", icon: "OP", color: "#10b981" },
      { type: "attack_vector", name: "Attack", symbol: "ATK", allegiance: "friendly", role: "Assault Axis / Thrust Vector", icon: "➔", color: "#ef4444" },
      { type: "bridge_pos", name: "Bridge", symbol: "BRG", allegiance: "friendly", role: "Strategic River Crossing Control", icon: "⚑", color: "#f59e0b" },
      { type: "platoon_a", name: "Platoon A", symbol: "PLT-A", allegiance: "friendly", role: "Assault Platoon", icon: "⌖", color: "#38bdf8" },
      { type: "platoon_b", name: "Platoon B", symbol: "PLT-B", allegiance: "friendly", role: "Support Platoon", icon: "⌖", color: "#38bdf8" },
      { type: "enemy_pos", name: "Enemy Position", symbol: "ENY", allegiance: "hostile", role: "Hostile Red Combat Sector", icon: "⚠", color: "#ef4444" }
    ];

    this.loadInitialScenario();
  }

  loadInitialScenario() {
    // Initial tactical deployment matching the exact commander plan in the screenshot
    this.units = [
      {
        id: "unit_hq_1",
        type: "div_hq",
        name: "HQ (1)",
        symbol: "HQ",
        allegiance: "friendly",
        coords: [313, 103],
        elevation: 420,
        status: "Command Active",
        orders: "Maintain sector oversight at Pushpa Nagar."
      },
      {
        id: "unit_op_1",
        type: "op_post",
        name: "OP (2)",
        symbol: "OP",
        allegiance: "friendly",
        coords: [200, 328],
        elevation: 520,
        status: "Surveillance Active",
        orders: "Observation at Hill 520 Crest."
      },
      {
        id: "unit_atk_1",
        type: "attack_vector",
        name: "Attack (3)",
        symbol: "ATK",
        allegiance: "friendly",
        coords: [472, 405],
        elevation: 440,
        status: "Assault Axis",
        orders: "Primary assault thrust across Central Bridge."
      },
      {
        id: "unit_brg_1",
        type: "bridge_pos",
        name: "Bridge (1)",
        symbol: "BRG",
        allegiance: "friendly",
        coords: [684, 492],
        elevation: 450,
        status: "Secured",
        orders: "Defend Nemi Cricket Stadium Bridge."
      },
      {
        id: "unit_eny_1",
        type: "enemy_pos",
        name: "Enemy Position",
        symbol: "ENY",
        allegiance: "hostile",
        coords: [650, 200],
        elevation: 480,
        status: "Hostile Red Force",
        orders: "Hostile strongpoint on Eastern Ridge."
      }
    ];

    // Compute GR for each unit
    this.units.forEach(u => {
      const gr = this.grEngine.getGR(u.coords[0], u.coords[1]);
      u.gr6 = gr.gr6;
      u.gr8 = gr.gr8;
    });
  }

  // --- Commander Planning Operations ---

  prepareAddUnit(typeKey) {
    const template = this.unitTypes.find(t => t.type === typeKey);
    if (!template) return;
    this.pendingAddUnitType = template;
    this.canvas.setAddUnitMode(true);
    window.app.showToast(`Click on map to place ${template.name}`);
  }

  executeAddUnitAt(px, py) {
    if (!this.pendingAddUnitType) return;

    const gr = this.grEngine.getGR(px, py);
    const countSameType = this.units.filter(u => u.type === this.pendingAddUnitType.type).length + 1;
    const newUnit = {
      id: `unit_${Date.now()}`,
      type: this.pendingAddUnitType.type,
      name: `${this.pendingAddUnitType.name} (${countSameType})`,
      symbol: this.pendingAddUnitType.symbol,
      allegiance: this.pendingAddUnitType.allegiance,
      coords: [Math.round(px), Math.round(py)],
      elevation: 440,
      status: "Operational",
      orders: "Execute standard tactical directive.",
      gr6: gr.gr6,
      gr8: gr.gr8
    };

    this.units.push(newUnit);
    this.selectedUnitId = newUnit.id;
    this.pendingAddUnitType = null;
    this.canvas.setAddUnitMode(false);
    this.canvas.render();
    this.renderUnitRoster();
    window.app.refreshPathingMetrics();
    window.app.showToast(`Unit ${newUnit.name} deployed at GR ${gr.gr6}`);
  }

  removeUnit(unitId) {
    const idx = this.units.findIndex(u => u.id === unitId);
    if (idx !== -1) {
      const removed = this.units.splice(idx, 1)[0];
      if (this.selectedUnitId === unitId) this.selectedUnitId = null;
      this.canvas.render();
      this.renderUnitRoster();
      window.app.refreshPathingMetrics();
      window.app.showToast(`Removed: ${removed.name}`);
    }
  }

  clearPlan() {
    if (confirm("Clear all commander plotted units from the map?")) {
      this.units = [];
      this.selectedUnitId = null;
      this.canvas.render();
      this.renderUnitRoster();
      window.app.refreshPathingMetrics();
      window.app.showToast("All plotted units cleared.");
    }
  }

  async savePlan() {
    const planPayload = {
      name: this.planName,
      timestamp: new Date().toISOString(),
      units: this.units,
      territories: {
        blue: window.app.territoryManager.blueLand.polygon,
        red: window.app.territoryManager.redLand.polygon
      }
    };

    try {
      await fetch('/api/plan/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planPayload)
      });
      localStorage.setItem('tactical_plan_saved', JSON.stringify(planPayload));
      window.app.showToast("Commander plan saved successfully!");
    } catch (e) {
      localStorage.setItem('tactical_plan_saved', JSON.stringify(planPayload));
      window.app.showToast("Commander plan saved to local cache.");
    }
  }

  updateUnitPosition(unitId, newPx, newPy) {
    const u = this.units.find(item => item.id === unitId);
    if (!u) return;

    u.coords = [Math.round(newPx), Math.round(newPy)];
    const gr = this.grEngine.getGR(newPx, newPy);
    u.gr6 = gr.gr6;
    u.gr8 = gr.gr8;

    this.canvas.render();
    this.renderUnitRoster();
    window.app.refreshPathingMetrics();
  }

  exportPlanJSON() {
    const planPayload = {
      title: "INDIAN MILITARY MAP - COMMANDER TACTICAL MISSION SPECIFICATION",
      planName: this.planName,
      generatedAt: new Date().toISOString(),
      utmZone: this.grEngine.utmZone,
      scale: `1:${this.grEngine.scaleRatio}`,
      units: this.units,
      territories: {
        blueLand: window.app.territoryManager.blueLand,
        redLand: window.app.territoryManager.redLand
      }
    };

    const blob = new Blob([JSON.stringify(planPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Commander_Plan_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    window.app.showToast("Tactical Mission JSON exported.");
  }

  exportPlanPNG() {
    const dataUrl = this.canvas.exportToImage();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `Commander_Tactical_Map_${Date.now()}.png`;
    a.click();
    window.app.showToast("Tactical Map exported as PNG.");
  }

  renderUnitRoster() {
    const container = document.getElementById('commander-plan-list');
    if (!container) return;

    if (this.units.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-dim); padding: 8px; font-family: var(--font-mono); font-size: 10px;">
          No units plotted. Click [+ Add HQ] or [+ Add OP] to deploy.
        </div>
      `;
      return;
    }

    container.innerHTML = this.units.map(u => {
      const isSelected = (u.id === this.selectedUnitId);
      const isFriendly = (u.allegiance === 'friendly');

      // Get icon badge
      let badgeStyle = "background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid #38bdf8;";
      let iconText = "HQ";
      if (u.type === 'op_post') {
        badgeStyle = "background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid #10b981;";
        iconText = "OP";
      } else if (u.type === 'attack_vector') {
        badgeStyle = "background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid #ef4444;";
        iconText = "➔";
      } else if (u.type === 'bridge_pos') {
        badgeStyle = "background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid #f59e0b;";
        iconText = "⚑";
      } else if (!isFriendly) {
        badgeStyle = "background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid #ef4444;";
        iconText = "⚠";
      }

      return `
        <div class="commander-plan-row" style="${isSelected ? 'background: rgba(0, 255, 157, 0.1); border: 1px solid var(--accent-green);' : ''}" onclick="window.app.commanderPlanner.selectUnit('${u.id}')">
          <div class="plan-unit-name">
            <span class="legend-symbol-chip" style="${badgeStyle}">${iconText}</span>
            <span>${u.name}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="plan-unit-gr">— 45R ${u.gr6 || '--'}</span>
            <span style="color: var(--text-dim); cursor: pointer;" onclick="event.stopPropagation(); window.app.commanderPlanner.removeUnit('${u.id}')" title="Delete unit">✕</span>
          </div>
        </div>
      `;
    }).join('');
  }

  selectUnit(unitId) {
    this.selectedUnitId = unitId;
    this.renderUnitRoster();
    this.canvas.render();
  }

  getUnitById(id) {
    return this.units.find(u => u.id === id);
  }
}

window.CommanderPlanner = CommanderPlanner;
