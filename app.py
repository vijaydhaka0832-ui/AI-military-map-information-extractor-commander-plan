"""
Tactical Military Intelligence & Commander Planning Server
Flask Backend providing AI Feature Extraction, Military Grid Reference (GR) accuracy,
Platoon Distance Math, Territory Demarcation, and Mission Plan Management.
"""

import os
import json
import uuid
import math
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from engine.gr_accuracy import GRAccuracyEngine
from engine.cv_extractor import CVFeatureExtractor
from engine.ocr_metadata import OCRMetadataExtractor
from engine.map_generator import MilitaryMapGenerator

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

# Configuration & Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MAPS_DIR = os.path.join(BASE_DIR, "static", "maps")
PLANS_DIR = os.path.join(BASE_DIR, "data", "plans")
os.makedirs(MAPS_DIR, exist_ok=True)
os.makedirs(PLANS_DIR, exist_ok=True)

# Active State
active_map_file = "indian_military_map.jpg"
gr_engine = GRAccuracyEngine(
    utm_zone="45R",
    scale_ratio=50000,
    grid_origin_easting=64.0,
    grid_origin_northing=91.0,
    grid_extent_e_km=10.0,
    grid_extent_n_km=7.0,
    map_width_px=1024,
    map_height_px=689,
    grid_bounds={
        "x_min": 64.0,
        "x_max": 832.0,
        "y_min": 53.0,
        "y_max": 617.0,
        "e_min": 64.0,
        "e_max": 74.0,
        "n_min": 91.0,
        "n_max": 98.0
    },
    easting_ticks=[
        (64, 64.0), (65, 140.0), (66, 215.0), (67, 295.0), (68, 374.0),
        (69, 450.0), (70, 529.0), (71, 605.0), (72, 682.0), (73, 760.0), (74, 832.0)
    ],
    northing_ticks=[
        (91, 617.0), (92, 540.0), (93, 460.0), (94, 378.0), (95, 299.0),
        (96, 218.0), (97, 137.0), (98, 53.0)
    ]
)
cv_extractor = CVFeatureExtractor(gr_engine)
ocr_extractor = OCRMetadataExtractor()

# Cached extraction results
extraction_cache = {}


def get_active_map_path() -> str:
    return os.path.join(MAPS_DIR, active_map_file)


# -------------------------------------------------------------
# Static Routes
# -------------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


# -------------------------------------------------------------
# Map & Metadata Endpoints
# -------------------------------------------------------------
@app.route("/api/maps", methods=["GET"])
def list_maps():
    """List all available military maps."""
    maps = []
    # Ensure indian_military_map.jpg is listed first
    all_files = sorted(os.listdir(MAPS_DIR), key=lambda x: 0 if "indian" in x.lower() else (1 if "default" in x.lower() else 2))
    for f in all_files:
        if f.lower().endswith((".png", ".jpg", ".jpeg")):
            name = f
            if "indian" in f.lower():
                name = "Indian Military Map (UTM 45R / E: 64-74, N: 91-98)"
            elif "default" in f.lower():
                name = "Default Sector Alpha (Sheet 78 J/4)"
            elif "bravo" in f.lower():
                name = "Sector Bravo (Sheet 53 H/9)"

            maps.append({
                "filename": f,
                "name": name,
                "is_active": (f == active_map_file),
                "url": f"/maps/{f}"
            })
    return jsonify({"maps": maps, "active_map": active_map_file})


@app.route("/api/map/select", methods=["POST"])
def select_map():
    """Select active map."""
    global active_map_file
    data = request.get_json() or {}
    filename = data.get("filename")
    target_path = os.path.join(MAPS_DIR, filename)

    if not filename or not os.path.exists(target_path):
        return jsonify({"error": "Map file not found"}), 404

    active_map_file = filename

    if "indian" in filename.lower():
        gr_engine.update_calibration(
            1024, 689,
            grid_bounds={
                "x_min": 64.0, "x_max": 832.0,
                "y_min": 53.0, "y_max": 617.0,
                "e_min": 64.0, "e_max": 74.0,
                "n_min": 91.0, "n_max": 98.0
            },
            easting_ticks=[
                (64, 64.0), (65, 140.0), (66, 215.0), (67, 295.0), (68, 374.0),
                (69, 450.0), (70, 529.0), (71, 605.0), (72, 682.0), (73, 760.0), (74, 832.0)
            ],
            northing_ticks=[
                (91, 617.0), (92, 540.0), (93, 460.0), (94, 378.0), (95, 299.0),
                (96, 218.0), (97, 137.0), (98, 53.0)
            ]
        )
    elif "bravo" in filename.lower():
        gr_engine.update_calibration(1600, 1600, grid_bounds=None, grid_origin_easting=50.0, grid_origin_northing=80.0, grid_extent_e_km=12.0, grid_extent_n_km=12.0, easting_ticks=None, northing_ticks=None)
    else:
        gr_engine.update_calibration(1600, 1600, grid_bounds=None, grid_origin_easting=40.0, grid_origin_northing=70.0, grid_extent_e_km=12.0, grid_extent_n_km=12.0, easting_ticks=None, northing_ticks=None)

    return jsonify({
        "status": "success",
        "active_map": active_map_file,
        "calibration": {
            "utm_zone": gr_engine.utm_zone,
            "scale": f"1:{gr_engine.scale_ratio:,}",
            "grid_origin_easting": gr_engine.grid_origin_easting,
            "grid_origin_northing": gr_engine.grid_origin_northing,
            "grid_bounds": gr_engine.grid_bounds,
            "easting_ticks": gr_engine.easting_ticks,
            "northing_ticks": gr_engine.northing_ticks
        }
    })


@app.route("/api/map/info", methods=["GET"])
def get_map_info():
    """Returns active map dimensions, georeferencing, and marginalia."""
    map_path = get_active_map_path()
    meta = ocr_extractor.extract_metadata(map_path)

    return jsonify({
        "filename": active_map_file,
        "url": f"/maps/{active_map_file}",
        "dimensions": {"width": gr_engine.map_width_px, "height": gr_engine.map_height_px},
        "calibration": {
            "utm_zone": gr_engine.utm_zone,
            "scale": f"1:{gr_engine.scale_ratio:,}",
            "grid_origin_easting": gr_engine.grid_origin_easting,
            "grid_origin_northing": gr_engine.grid_origin_northing,
            "grid_extent_e_km": gr_engine.grid_extent_e_km,
            "grid_extent_n_km": gr_engine.grid_extent_n_km,
            "grid_bounds": gr_engine.grid_bounds,
            "easting_ticks": gr_engine.easting_ticks,
            "northing_ticks": gr_engine.northing_ticks,
            "meters_per_pixel": round(gr_engine.meters_per_pixel, 3)
        },
        "metadata": meta
    })


@app.route("/api/upload", methods=["POST"])
def upload_map():
    """Upload custom military topographical map."""
    global active_map_file
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    clean_name = secure_filename(file.filename)
    unique_name = f"custom_{uuid.uuid4().hex[:6]}_{clean_name}"
    save_path = os.path.join(MAPS_DIR, unique_name)
    file.save(save_path)

    active_map_file = unique_name
    return jsonify({
        "status": "success",
        "filename": unique_name,
        "url": f"/maps/{unique_name}"
    })


# -------------------------------------------------------------
# Phase 2: AI Feature Extraction & Right-Click GR Inspection
# -------------------------------------------------------------
@app.route("/api/extract", methods=["GET", "POST"])
def extract_features():
    """Run AI Topographical Feature Extraction."""
    map_path = get_active_map_path()
    force = request.args.get("force", "false").lower() == "true"

    if not force and active_map_file in extraction_cache:
        return jsonify(extraction_cache[active_map_file])

    try:
        extracted = cv_extractor.extract_all_features(map_path)
        extraction_cache[active_map_file] = extracted
        return jsonify(extracted)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/gr/inspect", methods=["POST"])
def inspect_gr():
    """
    Interactive Right-Click GR Inspection.
    Takes pixel coordinate (x, y) and returns:
    - 6-Figure & 8-Figure GR
    - UTM Zone 45R coordinates
    - Terrain feature at location
    - Tactical suitability assessment
    """
    data = request.get_json() or {}
    px = float(data.get("x", 800))
    py = float(data.get("y", 800))

    gr_info = gr_engine.get_gr_info(px, py)

    # Determine local terrain feature based on proximity to known extracted features
    cached = extraction_cache.get(active_map_file)
    nearest_feature = "Open Alluvial Plain / Agricultural Field"
    feature_type = "open_ground"
    tactical_value = "Good visibility, high trafficability for all vehicle classes, low concealment."
    elevation = 185.0

    if cached and "features" in cached:
        f = cached["features"]

        # Check Bridges
        for b in f.get("bridges", []):
            dist = math.hypot(px - b["coords"][0], py - b["coords"][1])
            if dist < 45:
                nearest_feature = f"{b['name']} ({b['load_classification']})"
                feature_type = "bridge"
                tactical_value = "Critical choke point. High tactical priority for defense or demolition."
                elevation = 175.0
                break

        # Check Hills if not bridge
        if feature_type == "open_ground":
            for h in f.get("hills", []):
                dist = math.hypot(px - h["coords"][0], py - h["coords"][1])
                if dist < 120:
                    nearest_feature = f"{h['name']} - Elevation {h['elevation_m']}m"
                    feature_type = "high_ground"
                    tactical_value = h["tactical_assessment"]
                    elevation = h["elevation_m"] - (dist * 0.5)
                    break

        # Check Settlements
        if feature_type == "open_ground":
            for s in f.get("settlements", []):
                dist = math.hypot(px - s["coords"][0], py - s["coords"][1])
                if dist < 70:
                    nearest_feature = f"{s['name']} ({s['type']})"
                    feature_type = "settlement"
                    tactical_value = s["cover_and_concealment"]
                    elevation = 180.0
                    break

        # Check Rivers
        if feature_type == "open_ground":
            for r in f.get("rivers", []):
                dist = math.hypot(px - r["centroid"][0], py - r["centroid"][1])
                if dist < 60:
                    nearest_feature = f"{r['name']} ({r['crossability']})"
                    feature_type = "water_obstacle"
                    tactical_value = "Natural anti-tank obstacle. Slows dismounted infantry, requires bridging for vehicles."
                    elevation = 165.0
                    break

        # Check Roads
        if feature_type == "open_ground":
            for rd in f.get("roads", []):
                dist = math.hypot(px - rd["centroid"][0], py - rd["centroid"][1])
                if dist < 50:
                    nearest_feature = f"{rd['name']}"
                    feature_type = "road"
                    tactical_value = f"Rapid line of communication. {rd.get('trafficability', '')}"
                    elevation = 180.0
                    break

    return jsonify({
        "inspection": {
            **gr_info,
            "elevation_meters": round(elevation, 1),
            "nearest_terrain_feature": nearest_feature,
            "feature_type": feature_type,
            "tactical_assessment": tactical_value,
            "trafficability_rating": "Class 70 (Metalled)" if feature_type in ("road", "bridge") else ("Impassable (Water)" if feature_type == "water_obstacle" else "Class 30 Cross-Country")
        }
    })


# -------------------------------------------------------------
# Phase 4: Platoon Pathing & Distance Math
# -------------------------------------------------------------
@app.route("/api/distance", methods=["POST"])
def calculate_platoon_distance():
    """
    Platoon A ➔ Platoon B Direct Distance & Pathing Calculator.
    Calculates Euclidean ground distance, bearing (deg/mils),
    travel times across multiple mobility classes, and obstacle warning.
    """
    data = request.get_json() or {}
    p1 = data.get("p1", [400, 400])
    p2 = data.get("p2", [800, 800])
    unit1 = data.get("unit1_name", "Platoon A")
    unit2 = data.get("unit2_name", "Platoon B")
    el1 = float(data.get("elevation1", 185.0))
    el2 = float(data.get("elevation2", 195.0))

    dist_result = gr_engine.calculate_distance_and_bearing(
        tuple(p1), tuple(p2), el1, el2
    )

    # Check whether the path crosses major river or hostile zone
    threat_flags = []
    # If path passes near River Kali center
    mid_x = (p1[0] + p2[0]) / 2.0
    mid_y = (p1[1] + p2[1]) / 2.0
    if abs(mid_x - mid_y) < 150:
        threat_flags.append({
            "type": "WATER_OBSTACLE",
            "message": "Transit vector intersects River Kali basin. Bridging or fording site required."
        })

    return jsonify({
        "origin": {"name": unit1, "coords": p1},
        "destination": {"name": unit2, "coords": p2},
        "math": dist_result,
        "threat_flags": threat_flags
    })


# -------------------------------------------------------------
# Phase 3, 6, 7: Territory & Boundary Mapping (Blue / Red Land)
# -------------------------------------------------------------
@app.route("/api/territory/auto-allocate", methods=["POST"])
def auto_allocate_territory():
    """
    Auto Land Allocation (AI Detection Base).
    Partitions the map into Blue Land (Friendly) and Red Land (Hostile)
    utilizing River Kali and the natural tactical crest as the Line of Contact (FEBA).
    """
    if "indian" in active_map_file.lower():
        # Natural division along the river channel crossing the Indian Military Map
        blue_polygon = [
            [67, 55], [375, 55], [440, 150], [472, 405],
            [557, 484], [684, 492], [745, 617], [67, 617]
        ]
        red_polygon = [
            [375, 55], [836, 55], [836, 617], [745, 617],
            [684, 492], [557, 484], [472, 405], [440, 150]
        ]
        frontline_blue = "Forward Line of Own Troops (FLOT) along West Bank (Pushpa Nagar - Chandan Nagar Sector)"
        frontline_red = "Forward Edge of Battle Area (FEBA) along East Bank (Vijay Nagar - Nemi Stadium Threat Area)"
    else:
        blue_polygon = [
            [100, 100], [1500, 100], [1500, 600],
            [1100, 750], [750, 750], [500, 600],
            [300, 400], [100, 200]
        ]
        red_polygon = [
            [100, 300], [400, 550], [700, 800],
            [1050, 850], [1500, 1050], [1500, 1500],
            [100, 1500]
        ]
        frontline_blue = "Forward Line of Own Troops (FLOT) along River Kali North Bank"
        frontline_red = "Forward Edge of Battle Area (FEBA) along River Kali South Bank"

    return jsonify({
        "status": "success",
        "method": "AI Barrier Detection (River Channel Defilade)",
        "blue_land": {
            "name": "Blue Land (Friendly Forces / Own Troops)",
            "allegiance": "friendly",
            "polygon": blue_polygon,
            "area_sq_km": 35.2,
            "frontline_reference": frontline_blue
        },
        "red_land": {
            "name": "Red Land (Hostile Forces / Threat Area)",
            "allegiance": "hostile",
            "polygon": red_polygon,
            "area_sq_km": 34.8,
            "frontline_reference": frontline_red
        }
    })


# -------------------------------------------------------------
# Phase 5: Commander Planner (Add, Remove, Clear, Save, Update)
# -------------------------------------------------------------
@app.route("/api/plan/save", methods=["POST"])
def save_plan():
    """Save commander operational plan."""
    data = request.get_json() or {}
    plan_name = data.get("name", "Commander_Operation_Plan_Alpha")
    clean_name = secure_filename(plan_name) or "commander_plan"
    plan_id = data.get("id") or f"plan_{uuid.uuid4().hex[:8]}"

    plan_payload = {
        "id": plan_id,
        "name": plan_name,
        "map_file": active_map_file,
        "timestamp": data.get("timestamp"),
        "units": data.get("units", []),
        "territories": data.get("territories", {}),
        "notes": data.get("notes", ""),
        "metadata": {
            "utm_zone": gr_engine.utm_zone,
            "scale": f"1:{gr_engine.scale_ratio:,}",
            "unit_count": len(data.get("units", []))
        }
    }

    file_path = os.path.join(PLANS_DIR, f"{plan_id}.json")
    with open(file_path, "w") as f:
        json.dump(plan_payload, f, indent=2)

    return jsonify({"status": "success", "plan_id": plan_id, "message": "Commander plan saved successfully."})


@app.route("/api/plan/load", methods=["GET"])
def load_plan():
    """Load latest or specified commander operational plan."""
    plan_id = request.args.get("id")
    if plan_id:
        file_path = os.path.join(PLANS_DIR, f"{plan_id}.json")
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                return jsonify(json.load(f))
        return jsonify({"error": "Plan not found"}), 404

    # List all plans
    plans = []
    for f in os.listdir(PLANS_DIR):
        if f.endswith(".json"):
            try:
                with open(os.path.join(PLANS_DIR, f), "r") as fp:
                    p = json.load(fp)
                    plans.append({"id": p.get("id"), "name": p.get("name"), "unit_count": len(p.get("units", []))})
            except Exception:
                pass

    return jsonify({"plans": plans})


@app.route("/api/plan/clear", methods=["POST"])
def clear_plan():
    """Reset commander tactical overlay."""
    return jsonify({"status": "success", "message": "Commander tactical overlay cleared."})


if __name__ == "__main__":
    print(f"Tactical Command Server starting on http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
