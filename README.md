# AI Base Information Extractor from Military Map & Commander Tactical Planner

An operational, high-precision tactical command system that extracts topographical intelligence (roads, rivers, bridges, railway lines, ponds, hills, spot heights, and OCR marginalia) from military maps, provides interactive Right-Click Military Grid Reference (GR) inspection, computes direct platoon pathing & distance math across all deployed units, demarcates Blue & Red Land territories (both manually by the commander and via AI detection), and facilitates complete commander planning (Add, Remove, Clear, Save, Update, and Export).

---

## 🎯 Architecture & Phases

### Phase 1: Dark Tactical Theme Professional Dashboard
- **Styling**: Military Dark Theme (`#090d14` stealth background, neon tactical green `#00ff9d` HUD accents, friendly blue `#38bdf8`, hostile red `#f43f5e`, amber alert `#f59e0b`).
- **Project Title**: `AI BASE INFORMATION EXTRACTOR & COMMANDER TACTICAL PLANNER`
- **Subtitle**: `Information Extractor (Road, River, Bridge, Railway Line, Ponds, Hill, Spot Heights) & Commander Planning (Tactical Plotting, Deploying, Pathing, GR Inspection & Territory Allocation)`
- **Dynamic Viewport**: Interactive Canvas supporting pan, zoom, scale-to-fit, compass orientation, and live cursor coordinates.

### Phase 2: OCR, Metadata & Military Grid Reference (GR) Accuracy Engine
- **Marginalia & Map Info Extraction**:
  - Calibrated for **UTM Zone 45R** at **1:50,000 Scale** (2 cm to 1 km).
  - Automatically parses Sheet Number (`Sheet 78 J/4`), Contour Interval (`20 Metres`), Datum (`WGS 84`), Magnetic Declination (`1° 15' W`), and Tactical Sphere of Influence (`E 40-52 / N 70-82`).
- **Interactive Right-Click GR Inspection**:
  - Right-click anywhere on the topographical map to instantly trigger an interactive inspection HUD popover.
  - Displays **6-Figure GR** (e.g., `458 721`) and **8-Figure GR** (e.g., `4582 7214`).
  - Displays full Easting/Northing in km, estimated ground elevation, nearest detected terrain feature (e.g. *River Kali Bridge*, *Kali Crest Spot 412*, *NH-31 Highway*, *Rampur Town*), trafficability rating, and tactical assessment.
  - Features one-click **"Deploy Unit Here"** action.

### Phase 3 & Phases 6-7: Territory & Boundary Mapping (Blue / Red Land)
- **Manual Territory Polygon Drawing (Decided Manually by the User)**:
  - **Blue Land (Own Troops / Friendly)**: Click "Draw Blue Polygon" to demarcate friendly operational sectors, forward assembly zones, and sovereign ground.
  - **Red Land (Hostile Forces / Threat Area)**: Click "Draw Red Polygon" to demarcate adversary positions and danger sectors.
  - Interactive click-to-point drawing, vertex counting, double-click or button to finish, and live area calculation ($km^2$).
- **Auto Land Allocation (AI Detection Base)**:
  - Automatically partitions the operational map along natural defilade barriers (River Kali deep waterway and contour ridge lines) into Forward Line of Own Troops (FLOT) and Forward Edge of Battle Area (FEBA).

### Phase 4: Platoon Pathing & Distance Math
- **Platoon A ➔ Platoon B Direct Distance Calculator**:
  - Select Origin (e.g. `Platoon A`) and Destination (e.g. `Platoon B` or any other unit).
  - Computes **Direct Euclidean Ground Distance** in Kilometres, Metres, and Yards.
  - Computes **Grid Azimuth / Bearing** in Degrees ($0^\circ - 360^\circ$) and **Military Mils** (NATO $6400\,\text{mils}$ standard).
  - Computes Back Azimuth / Bearing and Elevation Delta ($\Delta H$).
  - **Tactical Movement Time Estimates**:
    - Dismounted Infantry Foot Patrol (4 km/h)
    - Quick Tactical March (6 km/h)
    - Armored / Tracked Cross-Country (22 km/h)
    - Armored on Road (NH-31: 45 km/h)
  - Renders a glowing vector arrow with distance & azimuth callout box on the tactical map.
- **Dynamic All Plotted Units Distance Matrix**:
  - A real-time pairwise distance matrix table calculating distances ($km$) and bearings between **every single commander-plotted unit** on the battlefield!

### Phase 5: Commander Planner & Export
- **Tactical Unit Roster & Placement**:
  - Units supported: `Div HQ`, `Bde HQ`, `Platoon A`, `Platoon B`, `Platoon C`, `OP Post`, `Mortar Pos`, `Armor Troop`, `Arty Battery`, `Red Patrol`.
- **Commander Planning Options**:
  - **[+ Add Unit]**: Select unit from palette and click anywhere on the map or deploy directly from Right-Click GR inspection.
  - **[- Remove Unit]**: Delete any plotted unit from the tactical roster.
  - **[Clear Plan]**: Reset the operational tactical overlay.
  - **[Save Plan]**: Persist plan to server and local mission cache.
  - **[Update Plan]**: Drag and drop any unit on the map to reposition with live coordinate updates.
  - **[Export PNG]**: Export the high-resolution operational overlay map as a PNG image.
  - **[Export JSON]**: Export the complete tactical mission specification as standard JSON.

---

## 🚀 Quickstart & Execution

To launch the Tactical Command Server:

```bash
python run.py
```

Then open your browser at:
```
http://127.0.0.1:5000
```

---

## 🧪 Automated Verification Suite

Run all automated unit and integration tests:

```bash
# Core Coordinate, CV Feature Extraction & OCR tests
python tests/test_engine.py

# Flask API & Endpoint Integration tests
python tests/test_api.py
```
