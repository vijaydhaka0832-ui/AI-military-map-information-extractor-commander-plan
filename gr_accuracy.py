"""
Military Grid Reference (GR) Accuracy and Georeferencing Engine.
Supports UTM Zone 45R, Scale 1:50,000.
Converts pixel coordinates to 6-figure and 8-figure Military Grid References (MGRS).
Computes direct tactical distance, azimuth in degrees and mils, and movement estimates.
Supports explicit bounding-box calibration for scanned military topographic maps.
"""

import math
from typing import Dict, Any, Tuple, Optional


class GRAccuracyEngine:
    def __init__(
        self,
        utm_zone: str = "45R",
        scale_ratio: int = 50000,
        grid_origin_easting: float = 64.0,   # km (Easting 64)
        grid_origin_northing: float = 91.0,  # km (Northing 91)
        grid_extent_e_km: float = 10.0,      # 10 km (64 to 74)
        grid_extent_n_km: float = 7.0,       # 7 km (91 to 98)
        map_width_px: int = 1024,
        map_height_px: int = 689,
        grid_bounds: Optional[Dict[str, float]] = None,
        easting_ticks: Optional[list] = None,
        northing_ticks: Optional[list] = None,
        grid_extent_km: Optional[float] = None,
        margin_px: Optional[int] = None
    ):
        self.utm_zone = utm_zone
        self.scale_ratio = scale_ratio
        self.grid_origin_easting = grid_origin_easting
        self.grid_origin_northing = grid_origin_northing
        self.grid_extent_e_km = grid_extent_km if grid_extent_km is not None else grid_extent_e_km
        self.grid_extent_n_km = grid_extent_km if grid_extent_km is not None else grid_extent_n_km
        self.map_width_px = map_width_px
        self.map_height_px = map_height_px
        self.margin_px = margin_px

        if margin_px is not None and grid_bounds is None:
            self.grid_bounds = {
                "x_min": float(margin_px),
                "x_max": float(map_width_px - margin_px),
                "y_min": float(margin_px),
                "y_max": float(map_height_px - margin_px),
                "e_min": self.grid_origin_easting,
                "e_max": self.grid_origin_easting + self.grid_extent_e_km,
                "n_min": self.grid_origin_northing,
                "n_max": self.grid_origin_northing + self.grid_extent_n_km
            }
            self.easting_ticks = None
            self.northing_ticks = None
        else:
            # Default exact grid bounds for Indian Military Map
            self.grid_bounds = grid_bounds or {
                "x_min": 64.0,
                "x_max": 832.0,
                "y_min": 53.0,
                "y_max": 617.0,
                "e_min": 64.0,
                "e_max": 74.0,
                "n_min": 91.0,
                "n_max": 98.0
            }

            # Piecewise exact ticks for physical printed grid lines
            self.easting_ticks = easting_ticks if easting_ticks is not None else (
                [
                    (64, 64.0), (65, 140.0), (66, 215.0), (67, 295.0), (68, 374.0),
                    (69, 450.0), (70, 529.0), (71, 605.0), (72, 682.0), (73, 760.0), (74, 832.0)
                ] if grid_bounds is None else None
            )
            self.northing_ticks = northing_ticks if northing_ticks is not None else (
                [
                    (91, 617.0), (92, 540.0), (93, 460.0), (94, 378.0), (95, 299.0),
                    (96, 218.0), (97, 137.0), (98, 53.0)
                ] if grid_bounds is None else None
            )

        self._recompute_calibration()

    def _recompute_calibration(self):
        if self.grid_bounds:
            b = self.grid_bounds
            dx_px = max(1.0, b["x_max"] - b["x_min"])
            dy_px = max(1.0, b["y_max"] - b["y_min"])
            de_m = (b["e_max"] - b["e_min"]) * 1000.0
            dn_m = (b["n_max"] - b["n_min"]) * 1000.0

            self.meters_per_pixel_x = de_m / dx_px
            self.meters_per_pixel_y = dn_m / dy_px
            self.meters_per_pixel = (self.meters_per_pixel_x + self.meters_per_pixel_y) / 2.0
            self.grid_origin_easting = b["e_min"]
            self.grid_origin_northing = b["n_min"]
            self.grid_extent_e_km = b["e_max"] - b["e_min"]
            self.grid_extent_n_km = b["n_max"] - b["n_min"]
        else:
            self.meters_per_pixel = (self.grid_extent_e_km * 1000.0) / (self.map_width_px * 0.8)
            self.meters_per_pixel_x = self.meters_per_pixel
            self.meters_per_pixel_y = self.meters_per_pixel

    def update_calibration(
        self,
        map_width_px: int,
        map_height_px: int,
        grid_bounds: Optional[Dict[str, float]] = None,
        grid_origin_easting: float = 64.0,
        grid_origin_northing: float = 91.0,
        grid_extent_e_km: float = 10.0,
        grid_extent_n_km: float = 7.0,
        easting_ticks: Optional[list] = None,
        northing_ticks: Optional[list] = None
    ):
        """Update calibration when switching maps."""
        self.map_width_px = map_width_px
        self.map_height_px = map_height_px
        self.grid_bounds = grid_bounds
        self.grid_origin_easting = grid_origin_easting
        self.grid_origin_northing = grid_origin_northing
        self.grid_extent_e_km = grid_extent_e_km
        self.grid_extent_n_km = grid_extent_n_km
        self.easting_ticks = easting_ticks
        self.northing_ticks = northing_ticks
        self._recompute_calibration()

    def pixel_to_grid(self, px: float, py: float) -> Tuple[float, float]:
        """
        Convert pixel (x, y) to Easting and Northing in kilometers.
        Uses exact piecewise linear interpolation across calibrated grid lines.
        """
        # 1. Piecewise Easting (READ RIGHT)
        if self.easting_ticks and len(self.easting_ticks) >= 2:
            et = self.easting_ticks
            if px <= et[0][1]:
                dx_per_km = et[1][1] - et[0][1]
                easting_km = et[0][0] + ((px - et[0][1]) / dx_per_km)
            elif px >= et[-1][1]:
                dx_per_km = et[-1][1] - et[-2][1]
                easting_km = et[-1][0] + ((px - et[-1][1]) / dx_per_km)
            else:
                easting_km = et[0][0]
                for i in range(len(et) - 1):
                    e1, x1 = et[i]
                    e2, x2 = et[i+1]
                    if x1 <= px <= x2:
                        frac = (px - x1) / (x2 - x1)
                        easting_km = e1 + frac * (e2 - e1)
                        break
        elif self.grid_bounds:
            b = self.grid_bounds
            norm_x = (px - b["x_min"]) / (b["x_max"] - b["x_min"])
            easting_km = b["e_min"] + (norm_x * (b["e_max"] - b["e_min"]))
        else:
            norm_x = px / self.map_width_px
            easting_km = self.grid_origin_easting + (norm_x * self.grid_extent_e_km)

        # 2. Piecewise Northing (THEN UP)
        # Note: nt is sorted from bottom (lowest northing, highest py) to top (highest northing, lowest py)
        if self.northing_ticks and len(self.northing_ticks) >= 2:
            nt = self.northing_ticks
            if py >= nt[0][1]:
                # Below the bottom grid line (extrapolate south)
                dy_per_km = nt[0][1] - nt[1][1]
                northing_km = nt[0][0] - ((py - nt[0][1]) / dy_per_km)
            elif py <= nt[-1][1]:
                # Above the top grid line (extrapolate north)
                dy_per_km = nt[-2][1] - nt[-1][1]
                northing_km = nt[-1][0] + ((nt[-1][1] - py) / dy_per_km)
            else:
                northing_km = nt[0][0]
                for i in range(len(nt) - 1):
                    n1, y1 = nt[i]      # e.g. (91, 617)
                    n2, y2 = nt[i+1]    # e.g. (92, 540)
                    if y2 <= py <= y1:
                        frac = (y1 - py) / (y1 - y2)
                        northing_km = n1 + frac * (n2 - n1)
                        break
        elif self.grid_bounds:
            b = self.grid_bounds
            norm_y = (b["y_max"] - py) / (b["y_max"] - b["y_min"])
            northing_km = b["n_min"] + (norm_y * (b["n_max"] - b["n_min"]))
        else:
            norm_y = 1.0 - (py / self.map_height_px)
            northing_km = self.grid_origin_northing + (norm_y * self.grid_extent_n_km)

        return easting_km, northing_km

    def grid_to_pixel(self, easting_km: float, northing_km: float) -> Tuple[float, float]:
        """Convert Easting and Northing (km) back to pixel coordinates."""
        # Easting to X
        if self.easting_ticks and len(self.easting_ticks) >= 2:
            et = self.easting_ticks
            if easting_km <= et[0][0]:
                dx_per_km = et[1][1] - et[0][1]
                px = et[0][1] + ((easting_km - et[0][0]) * dx_per_km)
            elif easting_km >= et[-1][0]:
                dx_per_km = et[-1][1] - et[-2][1]
                px = et[-1][1] + ((easting_km - et[-1][0]) * dx_per_km)
            else:
                px = et[0][1]
                for i in range(len(et) - 1):
                    e1, x1 = et[i]
                    e2, x2 = et[i+1]
                    if e1 <= easting_km <= e2:
                        frac = (easting_km - e1) / (e2 - e1)
                        px = x1 + frac * (x2 - x1)
                        break
        elif self.grid_bounds:
            b = self.grid_bounds
            norm_x = (easting_km - b["e_min"]) / (b["e_max"] - b["e_min"])
            px = b["x_min"] + (norm_x * (b["x_max"] - b["x_min"]))
        else:
            norm_x = (easting_km - self.grid_origin_easting) / self.grid_extent_e_km
            px = norm_x * self.map_width_px

        # Northing to Y
        if self.northing_ticks and len(self.northing_ticks) >= 2:
            nt = self.northing_ticks
            if northing_km <= nt[0][0]:
                dy_per_km = nt[0][1] - nt[1][1]
                py = nt[0][1] + ((nt[0][0] - northing_km) * dy_per_km)
            elif northing_km >= nt[-1][0]:
                dy_per_km = nt[-2][1] - nt[-1][1]
                py = nt[-1][1] - ((northing_km - nt[-1][0]) * dy_per_km)
            else:
                py = nt[0][1]
                for i in range(len(nt) - 1):
                    n1, y1 = nt[i]
                    n2, y2 = nt[i+1]
                    if n1 <= northing_km <= n2:
                        frac = (northing_km - n1) / (n2 - n1)
                        py = y1 - frac * (y1 - y2)
                        break
        elif self.grid_bounds:
            b = self.grid_bounds
            norm_y = (northing_km - b["n_min"]) / (b["n_max"] - b["n_min"])
            py = b["y_max"] - (norm_y * (b["y_max"] - b["y_min"]))
        else:
            norm_y = (northing_km - self.grid_origin_northing) / self.grid_extent_n_km
            py = (1.0 - norm_y) * self.map_height_px

        return px, py

    def get_gr_info(self, px: float, py: float) -> Dict[str, Any]:
        """
        Calculate Military Grid Reference details from a pixel coordinate:
        - 6-Figure GR: 6 continuous digits (Easting 3 digits + Northing 3 digits, e.g. '674937')
        - 8-Figure GR: 8 continuous digits (Easting 4 digits + Northing 4 digits, e.g. '67429375')
        - Easting & Northing 3-digit individual components
        - Easting & Northing in kilometers
        - Military Doctrine Rule: READ RIGHT, THEN UP
        """
        easting_km, northing_km = self.pixel_to_grid(px, py)

        easting_km = round(easting_km, 6)
        northing_km = round(northing_km, 6)

        e_km_int = int(math.floor(easting_km))
        n_km_int = int(math.floor(northing_km))

        e_frac_m = round((easting_km - e_km_int) * 1000.0, 2)
        n_frac_m = round((northing_km - n_km_int) * 1000.0, 2)

        e_frac_m = max(0.0, min(999.9, e_frac_m))
        n_frac_m = max(0.0, min(999.9, n_frac_m))

        # 6-figure GR:
        # READ RIGHT: Easting 2-digit grid line + 1 digit tenths (100m)
        # THEN UP:    Northing 2-digit grid line + 1 digit tenths (100m)
        e_square_2dig = e_km_int % 100
        n_square_2dig = n_km_int % 100
        e_tenth = max(0, min(9, int(math.floor((e_frac_m + 0.05) / 100.0))))
        n_tenth = max(0, min(9, int(math.floor((n_frac_m + 0.05) / 100.0))))

        easting_3fig = f"{e_square_2dig:02d}{e_tenth:01d}"
        northing_3fig = f"{n_square_2dig:02d}{n_tenth:01d}"

        # Standard Military format: solid 6 digits without space
        gr_6_fig = f"{easting_3fig}{northing_3fig}"
        gr_6_spaced = f"{easting_3fig} {northing_3fig}"

        # 8-figure GR: 2 digits grid line + 2 digits (10m)
        e_hundredth = max(0, min(99, int(math.floor((e_frac_m + 0.05) / 10.0))))
        n_hundredth = max(0, min(99, int(math.floor((n_frac_m + 0.05) / 10.0))))

        easting_4fig = f"{e_square_2dig:02d}{e_hundredth:02d}"
        northing_4fig = f"{n_square_2dig:02d}{n_hundredth:02d}"
        gr_8_fig = f"{easting_4fig}{northing_4fig}"
        gr_8_spaced = f"{easting_4fig} {northing_4fig}"

        utm_easting_m = 600000 + int((easting_km - 64.0) * 1000)
        utm_northing_m = 2500000 + int((northing_km - 91.0) * 1000)

        return {
            "gr_6_figure": gr_6_fig,
            "gr_6_formatted": gr_6_spaced,
            "easting_3fig": easting_3fig,
            "northing_3fig": northing_3fig,
            "gr_8_figure": gr_8_fig,
            "gr_8_formatted": gr_8_spaced,
            "doctrine_rule": "READ RIGHT, THEN UP (Easting 3 digits + Northing 3 digits)",
            "easting_km": round(easting_km, 4),
            "northing_km": round(northing_km, 4),
            "utm_easting_m": utm_easting_m,
            "utm_northing_m": utm_northing_m,
            "utm_zone": self.utm_zone,
            "scale": f"1:{self.scale_ratio:,}",
            "grid_square": f"{e_square_2dig:02d}{n_square_2dig:02d}",
            "pixel_x": int(round(px)),
            "pixel_y": int(round(py)),
            "meters_per_pixel": round(self.meters_per_pixel, 2)
        }

    def calculate_distance_and_bearing(
        self,
        p1: Tuple[float, float],
        p2: Tuple[float, float],
        elevation1: float = 450.0,
        elevation2: float = 480.0
    ) -> Dict[str, Any]:
        """
        Calculate direct tactical distance and military azimuth/bearing between Point 1 and Point 2.
        """
        e1, n1 = self.pixel_to_grid(p1[0], p1[1])
        e2, n2 = self.pixel_to_grid(p2[0], p2[1])

        delta_e_km = e2 - e1
        delta_n_km = n2 - n1

        delta_e_m = delta_e_km * 1000.0
        delta_n_m = delta_n_km * 1000.0

        ground_distance_m = math.hypot(delta_e_m, delta_n_m)
        ground_distance_km = ground_distance_m / 1000.0

        delta_elevation_m = elevation2 - elevation1
        slant_distance_m = math.hypot(ground_distance_m, delta_elevation_m)

        bearing_rad = math.atan2(delta_e_m, delta_n_m)
        bearing_deg = (math.degrees(bearing_rad) + 360.0) % 360.0
        bearing_mils = (bearing_deg / 360.0) * 6400.0

        back_bearing_deg = (bearing_deg + 180.0) % 360.0
        back_bearing_mils = (back_bearing_deg / 360.0) * 6400.0

        slope_pct = (delta_elevation_m / ground_distance_m * 100.0) if ground_distance_m > 0 else 0.0
        slope_penalty = 1.0 + (abs(slope_pct) * 0.03)

        foot_hours = (ground_distance_km / 4.0) * slope_penalty
        quick_hours = (ground_distance_km / 6.0) * slope_penalty
        armored_cc_hours = ground_distance_km / 22.0
        armored_road_hours = ground_distance_km / 45.0

        return {
            "distance_meters": round(ground_distance_m, 1),
            "distance_km": round(ground_distance_km, 3),
            "distance_yards": round(ground_distance_m * 1.09361, 1),
            "slant_distance_meters": round(slant_distance_m, 1),
            "bearing_degrees": round(bearing_deg, 1),
            "bearing_mils": int(round(bearing_mils)),
            "back_bearing_degrees": round(back_bearing_deg, 1),
            "back_bearing_mils": int(round(back_bearing_mils)),
            "elevation_delta_meters": round(delta_elevation_m, 1),
            "slope_percent": round(slope_pct, 2),
            "travel_times": {
                "foot_patrol": self._format_duration(foot_hours),
                "quick_march": self._format_duration(quick_hours),
                "armored_cross_country": self._format_duration(armored_cc_hours),
                "armored_road": self._format_duration(armored_road_hours)
            }
        }

    def _format_duration(self, hours: float) -> Dict[str, Any]:
        total_mins = int(round(hours * 60))
        h = total_mins // 60
        m = total_mins % 60
        if h > 0:
            formatted = f"{h}h {m:02d}m"
        else:
            formatted = f"{m} mins"
        return {
            "total_minutes": total_mins,
            "formatted": formatted
        }
