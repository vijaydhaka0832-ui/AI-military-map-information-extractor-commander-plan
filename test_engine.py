import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from engine.gr_accuracy import GRAccuracyEngine
from engine.cv_extractor import CVFeatureExtractor
from engine.ocr_metadata import OCRMetadataExtractor


class TestTacticalEngine(unittest.TestCase):
    def setUp(self):
        self.gr_engine = GRAccuracyEngine(
            utm_zone="45R",
            scale_ratio=50000,
            grid_origin_easting=40.0,
            grid_origin_northing=70.0,
            grid_extent_km=12.0,
            map_width_px=1600,
            map_height_px=1600,
            margin_px=100
        )
        self.cv_extractor = CVFeatureExtractor(self.gr_engine)
        self.ocr_extractor = OCRMetadataExtractor()
        self.test_map_path = "static/maps/default_military_map.png"

    def test_gr_math(self):
        # Center of the tactical area (800, 800)
        gr_info = self.gr_engine.get_gr_info(800, 800)
        self.assertIn("gr_6_figure", gr_info)
        self.assertIn("gr_8_figure", gr_info)
        self.assertEqual(gr_info["utm_zone"], "45R")
        self.assertEqual(gr_info["scale"], "1:50,000")

        # Easting should be around 46.0 km, Northing around 76.0 km
        self.assertAlmostEqual(gr_info["easting_km"], 46.0, delta=0.5)
        self.assertAlmostEqual(gr_info["northing_km"], 76.0, delta=0.5)

    def test_distance_and_bearing(self):
        # Point 1 (Platoon A at 500, 500), Point 2 (Platoon B at 900, 500)
        math_res = self.gr_engine.calculate_distance_and_bearing((500, 500), (900, 500))
        self.assertGreater(math_res["distance_meters"], 0)
        self.assertGreater(math_res["distance_km"], 0)
        # Directly east: bearing should be ~90 degrees (1600 mils)
        self.assertAlmostEqual(math_res["bearing_degrees"], 90.0, delta=2.0)
        self.assertAlmostEqual(math_res["bearing_mils"], 1600, delta=40)
        self.assertIn("foot_patrol", math_res["travel_times"])
        self.assertIn("armored_cross_country", math_res["travel_times"])

    def test_cv_extraction(self):
        if os.path.exists(self.test_map_path):
            results = self.cv_extractor.extract_all_features(self.test_map_path)
            stats = results["statistics"]
            features = results["features"]

            self.assertGreater(stats["roads_count"], 0)
            self.assertGreater(stats["rivers_count"], 0)
            self.assertGreater(stats["bridges_count"], 0)
            self.assertGreater(stats["railway_count"], 0)
            self.assertGreater(stats["ponds_count"], 0)
            self.assertGreater(stats["hills_count"], 0)

            # Check that bridge features have GR info
            for b in features["bridges"]:
                self.assertIn("gr_6_figure", b)
                self.assertIn("load_classification", b)

    def test_ocr_metadata(self):
        if os.path.exists(self.test_map_path):
            meta = self.ocr_extractor.extract_metadata(self.test_map_path)
            self.assertIn("utm_zone", meta)
            self.assertIn("scale", meta)
            self.assertIn("sheet_number", meta)


if __name__ == "__main__":
    unittest.main()
