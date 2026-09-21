"""
Military Topographical Map Generator.
Generates authentic 1:50,000 scale tactical maps with UTM Zone 45R grid lines,
contour lines, rivers, roads, bridges, railway lines, ponds, hills, and spot heights.
Produces crisp images ready for AI feature extraction and commander planning.
"""

import math
import random
from PIL import Image, ImageDraw, ImageFont
import numpy as np


class MilitaryMapGenerator:
    def __init__(
        self,
        width: int = 1600,
        height: int = 1600,
        margin: int = 100,
        utm_zone: str = "45R",
        scale: str = "1:50,000",
        sheet_no: str = "SHEET 78 J/4",
        grid_start_e: int = 40,
        grid_start_n: int = 70,
        grid_count: int = 12
    ):
        self.width = width
        self.height = height
        self.margin = margin
        self.utm_zone = utm_zone
        self.scale = scale
        self.sheet_no = sheet_no
        self.grid_start_e = grid_start_e
        self.grid_start_n = grid_start_n
        self.grid_count = grid_count

        self.inner_w = width - 2 * margin
        self.inner_h = height - 2 * margin
        self.grid_step_x = self.inner_w / grid_count
        self.grid_step_y = self.inner_h / grid_count

    def generate(self, seed: int = 42, theme: str = "tactical_survey") -> Image.Image:
        random.seed(seed)
        np.random.seed(seed)

        # Base parchment / map paper background: slightly aged tactical topo paper
        bg_color = (248, 245, 237)
        img = Image.new("RGB", (self.width, self.height), bg_color)
        draw = ImageDraw.Draw(img)

        # 1. Forest / Jungle areas (soft green patches)
        self._draw_vegetation(draw)

        # 2. Contour lines & Hill ridges (Brown 20m interval contours)
        self._draw_contours_and_hills(draw)

        # 3. Waterbodies: Ponds & Reservoirs (Cyan-blue fill)
        self._draw_ponds(draw)

        # 4. River Network (Major river + Meandering tributaries)
        self._draw_rivers(draw)

        # 5. Railway lines (Black hashed lines)
        self._draw_railway(draw)

        # 6. Road network (Metalled NH-31, secondary, cart tracks)
        self._draw_roads(draw)

        # 7. Bridges (Strategic crossings over river)
        self._draw_bridges(draw)

        # 8. Villages & Settlements (Red grid clusters)
        self._draw_settlements(draw)

        # 9. Military Grid Lines & Numbers (UTM 1km squares in purple/black)
        self._draw_military_grid(draw)

        # 10. Sheet Border, Marginalia, Title & Legend
        self._draw_marginalia(draw)

        return img

    def _draw_vegetation(self, draw: ImageDraw.Draw):
        forest_color = (220, 236, 215)
        # 3 major reserved forest patches
        forests = [
            [(250, 200), (450, 180), (520, 350), (400, 480), (220, 400)],
            [(1050, 300), (1350, 280), (1450, 520), (1200, 600), (980, 480)],
            [(700, 1050), (980, 950), (1100, 1200), (950, 1380), (680, 1250)]
        ]
        for poly in forests:
            draw.polygon(poly, fill=forest_color, outline=(195, 215, 188))
            # Text label
            cx = sum(p[0] for p in poly) // len(poly)
            cy = sum(p[1] for p in poly) // len(poly)
            draw.text((cx - 40, cy), "RESERVED FOREST", fill=(100, 140, 90))

    def _draw_contours_and_hills(self, draw: ImageDraw.Draw):
        contour_color = (180, 130, 90)
        index_contour = (140, 90, 50)

        # Hill 1: Northwest Ridge (Spot 412) - Center (420, 320)
        h1_center = (420, 320)
        radii_1 = [220, 180, 140, 100, 70, 40, 18]
        elevations_1 = [280, 300, 320, 340, 360, 380, 412]

        for r, el in zip(radii_1, elevations_1):
            is_index = (el % 100 == 0) or (el == 412)
            c = index_contour if is_index else contour_color
            w = 2 if is_index else 1
            # Wobbly ellipse for realistic contour
            points = []
            for deg in range(0, 360, 10):
                rad = math.radians(deg)
                distortion = 1.0 + 0.15 * math.sin(3 * rad) + 0.08 * math.cos(5 * rad)
                px = h1_center[0] + (r * 1.3) * distortion * math.cos(rad)
                py = h1_center[1] + (r * 0.9) * distortion * math.sin(rad)
                points.append((px, py))
            points.append(points[0])
            draw.line(points, fill=c, width=w)
            if is_index:
                draw.text((h1_center[0] + r - 10, h1_center[1]), str(el), fill=c)

        # Spot Height 412
        draw.polygon([(h1_center[0], h1_center[1] - 8), (h1_center[0] - 6, h1_center[1] + 6), (h1_center[0] + 6, h1_center[1] + 6)], fill=(120, 60, 20))
        draw.text((h1_center[0] + 8, h1_center[1] - 6), "△ 412 (KALI CREST)", fill=(120, 60, 20))

        # Hill 2: Northeast High Ground (Spot 385) - Center (1220, 420)
        h2_center = (1220, 420)
        radii_2 = [190, 150, 110, 75, 45, 20]
        elevations_2 = [280, 300, 320, 340, 360, 385]
        for r, el in zip(radii_2, elevations_2):
            is_index = (el % 100 == 0) or (el == 385)
            c = index_contour if is_index else contour_color
            w = 2 if is_index else 1
            points = []
            for deg in range(0, 360, 10):
                rad = math.radians(deg)
                distortion = 1.0 + 0.12 * math.cos(2 * rad) + 0.07 * math.sin(4 * rad)
                px = h2_center[0] + (r * 1.1) * distortion * math.cos(rad)
                py = h2_center[1] + (r * 1.2) * distortion * math.sin(rad)
                points.append((px, py))
            points.append(points[0])
            draw.line(points, fill=c, width=w)

        draw.ellipse([h2_center[0] - 3, h2_center[1] - 3, h2_center[0] + 3, h2_center[1] + 3], fill=(120, 60, 20))
        draw.text((h2_center[0] + 8, h2_center[1] - 6), ". 385 (OBSERVATION HILL)", fill=(120, 60, 20))

        # Hill 3: Southern Ridge (Spot 295) - Center (880, 1220)
        h3_center = (880, 1220)
        radii_3 = [160, 120, 80, 45, 18]
        elevations_3 = [220, 240, 260, 280, 295]
        for r, el in zip(radii_3, elevations_3):
            c = index_contour if el == 295 else contour_color
            w = 2 if el == 295 else 1
            points = []
            for deg in range(0, 360, 12):
                rad = math.radians(deg)
                distortion = 1.0 + 0.1 * math.sin(3 * rad)
                px = h3_center[0] + (r * 1.4) * distortion * math.cos(rad)
                py = h3_center[1] + (r * 0.8) * distortion * math.sin(rad)
                points.append((px, py))
            points.append(points[0])
            draw.line(points, fill=c, width=w)
        draw.text((h3_center[0] + 6, h3_center[1] - 5), ". 295 (DEVIL RIDGE)", fill=(120, 60, 20))

    def _draw_ponds(self, draw: ImageDraw.Draw):
        pond_fill = (150, 200, 240)
        pond_border = (40, 110, 180)

        ponds = [
            [(320, 750), (370, 720), (410, 760), (380, 810), (330, 800)],  # West Pond
            [(1320, 850), (1390, 830), (1420, 890), (1360, 930), (1300, 890)], # East Lake
            [(650, 350), (700, 330), (740, 370), (710, 420), (640, 390)],  # North Pond
            [(1150, 1280), (1200, 1250), (1250, 1290), (1220, 1340), (1160, 1320)] # South Pond
        ]
        labels = ["LAKE BHIM", "EAST RESERVOIR", "NORTH TANK", "DEVI POND"]

        for poly, lbl in zip(ponds, labels):
            draw.polygon(poly, fill=pond_fill, outline=pond_border)
            cx = sum(p[0] for p in poly) // len(poly)
            cy = sum(p[1] for p in poly) // len(poly)
            draw.text((cx - 30, cy + 18), lbl, fill=pond_border)

    def _draw_rivers(self, draw: ImageDraw.Draw):
        river_color = (60, 130, 220)
        sand_color = (235, 225, 195)

        # Main River Kali (flows from NW to SE, width ~ 24px)
        main_river = [
            (100, 180), (280, 260), (420, 450), (540, 620), (720, 780),
            (900, 880), (1100, 940), (1280, 1120), (1450, 1350), (1500, 1420)
        ]
        # Smooth spline points
        smooth_river = self._smooth_curve(main_river, subdivisions=8)

        # Draw river casing / sandbanks
        for i in range(len(smooth_river) - 1):
            p1, p2 = smooth_river[i], smooth_river[i+1]
            draw.line([p1, p2], fill=sand_color, width=28)

        # Draw water core
        for i in range(len(smooth_river) - 1):
            p1, p2 = smooth_river[i], smooth_river[i+1]
            draw.line([p1, p2], fill=river_color, width=20)

        draw.text((560, 640), "RIVER KALI (DEEP WATERWAY)", fill=(30, 80, 180))

        # Tributary 1 (from North)
        trib_1 = [(850, 100), (820, 280), (800, 450), (760, 640), (720, 780)]
        smooth_t1 = self._smooth_curve(trib_1, subdivisions=6)
        for i in range(len(smooth_t1) - 1):
            draw.line([smooth_t1[i], smooth_t1[i+1]], fill=river_color, width=7)
        draw.text((810, 320), "KALI NALA", fill=(30, 80, 180))

        # Tributary 2 (from Southwest)
        trib_2 = [(150, 1100), (320, 1020), (520, 930), (720, 780)]
        smooth_t2 = self._smooth_curve(trib_2, subdivisions=6)
        for i in range(len(smooth_t2) - 1):
            draw.line([smooth_t2[i], smooth_t2[i+1]], fill=river_color, width=6)
        draw.text((360, 990), "BASHIR STREAM", fill=(30, 80, 180))

    def _draw_railway(self, draw: ImageDraw.Draw):
        # Broad Gauge railway line crossing diagonally from West (100, 1150) to NE (1500, 200)
        rail_points = [(100, 1150), (380, 1020), (720, 780), (1060, 520), (1350, 320), (1500, 220)]
        smooth_rail = self._smooth_curve(rail_points, subdivisions=8)

        # Draw main black rail line
        for i in range(len(smooth_rail) - 1):
            draw.line([smooth_rail[i], smooth_rail[i+1]], fill=(30, 30, 30), width=4)

        # Cross-ties (sleepers) every ~16 pixels
        accum_dist = 0
        for i in range(len(smooth_rail) - 1):
            p1, p2 = smooth_rail[i], smooth_rail[i+1]
            seg_len = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
            accum_dist += seg_len
            if accum_dist >= 14:
                accum_dist = 0
                dx = p2[0] - p1[0]
                dy = p2[1] - p1[1]
                mag = math.hypot(dx, dy)
                if mag > 0:
                    nx = -dy / mag * 8
                    ny = dx / mag * 8
                    draw.line([(p1[0] - nx, p1[1] - ny), (p1[0] + nx, p1[1] + ny)], fill=(30, 30, 30), width=3)

        # Railway Station Rampur
        rs_pos = (1060, 520)
        draw.rectangle([rs_pos[0] - 12, rs_pos[1] - 8, rs_pos[0] + 12, rs_pos[1] + 8], fill=(220, 30, 30), outline=(0, 0, 0))
        draw.text((rs_pos[0] + 16, rs_pos[1] - 8), "RS RAMPUR (BROAD GAUGE)", fill=(20, 20, 20))

    def _draw_roads(self, draw: ImageDraw.Draw):
        # 1. National Highway NH-31 (Bold double red / amber line)
        nh_points = [(100, 550), (320, 560), (600, 680), (900, 880), (1200, 1150), (1500, 1250)]
        smooth_nh = self._smooth_curve(nh_points, subdivisions=8)

        # Highway base/casing
        for i in range(len(smooth_nh) - 1):
            draw.line([smooth_nh[i], smooth_nh[i+1]], fill=(180, 40, 20), width=10)
        # Highway center stripe
        for i in range(len(smooth_nh) - 1):
            draw.line([smooth_nh[i], smooth_nh[i+1]], fill=(255, 230, 90), width=4)

        draw.text((220, 530), "NATIONAL HIGHWAY NH-31 (METALLED)", fill=(160, 30, 15))

        # 2. Secondary Metalled Road (Single red line)
        sec_points = [(700, 100), (720, 400), (900, 880), (940, 1200), (950, 1500)]
        smooth_sec = self._smooth_curve(sec_points, subdivisions=6)
        for i in range(len(smooth_sec) - 1):
            draw.line([smooth_sec[i], smooth_sec[i+1]], fill=(210, 60, 40), width=5)
        draw.text((710, 220), "STATE HIGHWAY SH-14", fill=(180, 40, 30))

        # 3. Unmetalled Cart Track (Dashed ochre line)
        track_points = [(200, 250), (450, 320), (600, 420), (720, 400), (1050, 380)]
        smooth_track = self._smooth_curve(track_points, subdivisions=6)
        dash_len = 0
        draw_dash = True
        for i in range(len(smooth_track) - 1):
            p1, p2 = smooth_track[i], smooth_track[i+1]
            seg_len = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
            dash_len += seg_len
            if dash_len >= 12:
                dash_len = 0
                draw_dash = not draw_dash
            if draw_dash:
                draw.line([p1, p2], fill=(160, 120, 60), width=3)
        draw.text((460, 335), "CART TRACK (UNMETALLED)", fill=(130, 95, 40))

    def _draw_bridges(self, draw: ImageDraw.Draw):
        # Bridge 1: NH-31 Crossing River Kali at (900, 880)
        b1_pos = (900, 880)
        self._render_bridge_symbol(draw, b1_pos, angle_deg=-45, name="KALI HIGHWAY BRIDGE")

        # Bridge 2: Railway Bridge at (720, 780)
        b2_pos = (720, 780)
        self._render_bridge_symbol(draw, b2_pos, angle_deg=35, name="RAILWAY BRIDGE NO. 44")

        # Culvert 3: Secondary road crossing stream at (800, 450)
        b3_pos = (800, 450)
        self._render_bridge_symbol(draw, b3_pos, angle_deg=10, name="CULVERT 12")

    def _render_bridge_symbol(self, draw: ImageDraw.Draw, pos, angle_deg, name):
        rad = math.radians(angle_deg)
        dx = math.cos(rad) * 20
        dy = math.sin(rad) * 20
        # Perpendicular
        nx = -math.sin(rad) * 12
        ny = math.cos(rad) * 12

        # Standard military bridge symbol: two bracket bars
        p1 = (pos[0] - dx + nx, pos[1] - dy + ny)
        p2 = (pos[0] + dx + nx, pos[1] + dy + ny)
        p3 = (pos[0] - dx - nx, pos[1] - dy - ny)
        p4 = (pos[0] + dx - nx, pos[1] + dy - ny)

        # Bridge abutments (wings)
        w1 = (p1[0] - nx*0.5, p1[1] - ny*0.5)
        w2 = (p2[0] - nx*0.5, p2[1] - ny*0.5)
        w3 = (p3[0] + nx*0.5, p3[1] + ny*0.5)
        w4 = (p4[0] + nx*0.5, p4[1] + ny*0.5)

        draw.line([w1, p1, p2, w2], fill=(20, 20, 20), width=4)
        draw.line([w3, p3, p4, w4], fill=(20, 20, 20), width=4)
        # Highlight marker
        draw.ellipse([pos[0]-5, pos[1]-5, pos[0]+5, pos[1]+5], fill=(255, 215, 0), outline=(0, 0, 0))
        draw.text((pos[0] + 15, pos[1] - 12), f"[BRIDGE] {name}", fill=(10, 10, 10))

    def _draw_settlements(self, draw: ImageDraw.Draw):
        settlements = [
            {"name": "RAMPUR", "center": (1080, 570), "houses": 16},
            {"name": "BHIMNAGAR", "center": (350, 620), "houses": 12},
            {"name": "KISHANPUR", "center": (640, 610), "houses": 14},
            {"name": "DEVI GANJ", "center": (1180, 1200), "houses": 15},
            {"name": "CHOTI BASTI", "center": (760, 220), "houses": 8}
        ]

        for s in settlements:
            cx, cy = s["center"]
            # Draw house blocks (red squares/rectangles typical of topo sheets)
            for i in range(s["houses"]):
                hx = cx + int(random.gauss(0, 35))
                hy = cy + int(random.gauss(0, 30))
                hw = random.randint(8, 14)
                hh = random.randint(8, 14)
                draw.rectangle([hx, hy, hx + hw, hy + hh], fill=(210, 45, 30), outline=(130, 25, 15))

            # Settlement label
            draw.text((cx - 30, cy - 25), s["name"], fill=(180, 20, 15))

    def _draw_military_grid(self, draw: ImageDraw.Draw):
        # 1km UTM grid lines (Purple/Black fine lines)
        grid_color = (130, 90, 160, 180)

        # Vertical Eastings
        for i in range(self.grid_count + 1):
            x = int(self.margin + i * self.grid_step_x)
            draw.line([(x, self.margin), (x, self.height - self.margin)], fill=(120, 80, 150), width=1)
            # Easting label (e.g. 40, 41, 42...)
            easting_val = self.grid_start_e + i
            draw.text((x - 8, self.margin - 22), f"{easting_val:02d}", fill=(100, 50, 140))
            draw.text((x - 8, self.height - self.margin + 6), f"{easting_val:02d}", fill=(100, 50, 140))

        # Horizontal Northings
        for j in range(self.grid_count + 1):
            y = int(self.margin + j * self.grid_step_y)
            draw.line([(self.margin, y), (self.width - self.margin, y)], fill=(120, 80, 150), width=1)
            # Northing label (North is up, so top has highest Northing)
            northing_val = (self.grid_start_n + self.grid_count) - j
            draw.text((self.margin - 30, y - 6), f"{northing_val:02d}", fill=(100, 50, 140))
            draw.text((self.width - self.margin + 8, y - 6), f"{northing_val:02d}", fill=(100, 50, 140))

    def _draw_marginalia(self, draw: ImageDraw.Draw):
        # Outer border frame
        draw.rectangle([self.margin - 4, self.margin - 4, self.width - self.margin + 4, self.height - self.margin + 4], outline=(40, 40, 40), width=3)
        draw.rectangle([self.margin - 12, self.margin - 12, self.width - self.margin + 12, self.height - self.margin + 12], outline=(10, 10, 10), width=2)

        # Header Title Block
        header_text = f"TOPOGRAPHICAL TACTICAL SURVEY • {self.sheet_no}"
        draw.text((self.width // 2 - 200, 25), header_text, fill=(20, 20, 20))
        draw.text((self.width // 2 - 130, 48), "RESTRICTED / FOR MILITARY OPERATIONAL USE ONLY", fill=(180, 20, 20))

        # Left / Right marginalia metadata
        draw.text((self.margin, 70), f"UTM ZONE {self.utm_zone} (WGS84 DATUM)", fill=(50, 50, 50))
        draw.text((self.width - self.margin - 210, 70), f"SCALE {self.scale}", fill=(50, 50, 50))

        # Bottom Footer Marginalia
        draw.text((self.margin, self.height - 70), "CONTOUR INTERVAL 20 METRES • SPHERE OF INFLUENCE: EASTINGS 40-52 / NORTHINGS 70-82", fill=(40, 40, 40))
        draw.text((self.margin, self.height - 45), "GRID REFERENCE (MGRS): READ EASTING FIRST, THEN NORTHING (6-FIG / 8-FIG)", fill=(100, 50, 140))
        draw.text((self.width - self.margin - 320, self.height - 70), "MAGNETIC DECLINATION: 1°15' W (2026)", fill=(50, 50, 50))
        draw.text((self.width - self.margin - 320, self.height - 45), "ANNUAL CHANGE: 2' EASTWARD", fill=(50, 50, 50))

        # Scale bar at bottom center
        bar_x = self.width // 2 - 150
        bar_y = self.height - 50
        draw.rectangle([bar_x, bar_y, bar_x + 300, bar_y + 8], fill=(255, 255, 255), outline=(0, 0, 0))
        # 1km blocks on scale bar
        step = 300 / 6
        for b in range(6):
            if b % 2 == 0:
                draw.rectangle([bar_x + b * step, bar_y, bar_x + (b + 1) * step, bar_y + 8], fill=(0, 0, 0))
        draw.text((bar_x - 10, bar_y - 18), "0 km", fill=(0, 0, 0))
        draw.text((bar_x + 140, bar_y - 18), "2.5 km", fill=(0, 0, 0))
        draw.text((bar_x + 290, bar_y - 18), "5 km", fill=(0, 0, 0))

    def _smooth_curve(self, points, subdivisions=6):
        """Catmull-Rom or cubic spline interpolation for smooth river/road/rail lines."""
        if len(points) < 3:
            return points
        result = []
        for i in range(len(points) - 1):
            p0 = points[max(0, i - 1)]
            p1 = points[i]
            p2 = points[i + 1]
            p3 = points[min(len(points) - 1, i + 2)]

            for s in range(subdivisions):
                t = s / subdivisions
                # Catmull-rom spline calculation
                t2 = t * t
                t3 = t2 * t
                x = 0.5 * ((2 * p1[0]) +
                           (-p0[0] + p2[0]) * t +
                           (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
                           (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
                y = 0.5 * ((2 * p1[1]) +
                           (-p0[1] + p2[1]) * t +
                           (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
                           (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
                result.append((x, y))
        result.append(points[-1])
        return result


if __name__ == "__main__":
    gen = MilitaryMapGenerator()
    img = gen.generate()
    img.save("static/maps/default_military_map.png")
    print("Default military topographical map generated successfully.")
