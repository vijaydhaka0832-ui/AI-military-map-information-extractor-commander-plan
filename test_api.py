import unittest
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app


class TestTacticalAPIs(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()

    def test_01_index_html(self):
        resp = self.client.get('/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn(b"AI BASE INFORMATION EXTRACTOR", resp.data)
        self.assertIn(b"FROM MILITARY MAP", resp.data)

    def test_02_map_info(self):
        resp = self.client.get('/api/map/info')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertIn("calibration", data)
        self.assertEqual(data["calibration"]["utm_zone"], "45R")
        self.assertEqual(data["calibration"]["scale"], "1:50,000")
        self.assertIn("metadata", data)
        self.assertTrue("45R" in data["metadata"]["sheet_number"] or "78" in data["metadata"]["sheet_number"])

    def test_03_extract_features(self):
        resp = self.client.get('/api/extract')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertIn("statistics", data)
        self.assertIn("features", data)
        f = data["features"]
        self.assertGreater(len(f["roads"]), 0)
        self.assertGreater(len(f["rivers"]), 0)
        self.assertGreater(len(f["bridges"]), 0)
        self.assertGreater(len(f["railways"]), 0)
        self.assertGreater(len(f["ponds"]), 0)
        self.assertGreater(len(f["hills"]), 0)

    def test_04_gr_inspect(self):
        # Inspect pixel near center (500, 350)
        resp = self.client.post('/api/gr/inspect', json={"x": 500, "y": 350})
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        insp = data["inspection"]
        self.assertIn("gr_6_figure", insp)
        self.assertEqual(len(insp["gr_6_figure"]), 6)  # Must be 6 continuous digits (Easting 3 + Northing 3)
        self.assertIn("gr_8_figure", insp)
        self.assertIn("nearest_terrain_feature", insp)
        self.assertIn("tactical_assessment", insp)

    def test_04b_military_6fig_gr_doctrine(self):
        """
        Verify exact doctrine taught by user:
        READ RIGHT, THEN UP:
        - Easting: line 67 se 0.4 rightwards -> 674
        - Northing: line 93 se 0.7 upwards -> 937
        - 6-Figure GR: 674937
        """
        # Easting line 67 (x=295) and line 68 (x=374) -> 0.4 distance:
        x_test = 295.0 + 0.4 * (374.0 - 295.0)
        # Northing line 93 (y=460) and line 94 (y=378) -> 0.7 distance upwards:
        y_test = 460.0 - 0.7 * (460.0 - 378.0)

        resp = self.client.post('/api/gr/inspect', json={"x": x_test, "y": y_test})
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        insp = data["inspection"]
        self.assertEqual(insp["easting_3fig"], "674")
        self.assertEqual(insp["northing_3fig"], "937")
        self.assertEqual(insp["gr_6_figure"], "674937")

    def test_05_platoon_distance(self):
        # Platoon A to Platoon B
        payload = {
            "p1": [680, 650],
            "p2": [1020, 480],
            "unit1_name": "Platoon A",
            "unit2_name": "Platoon B",
            "elevation1": 190.0,
            "elevation2": 240.0
        }
        resp = self.client.post('/api/distance', json=payload)
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        math_data = data["math"]
        self.assertGreater(math_data["distance_km"], 0)
        self.assertIn("bearing_degrees", math_data)
        self.assertIn("bearing_mils", math_data)
        self.assertIn("travel_times", math_data)

    def test_06_territory_auto_allocate(self):
        resp = self.client.post('/api/territory/auto-allocate')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.data)
        self.assertEqual(data["status"], "success")
        self.assertIn("blue_land", data)
        self.assertIn("red_land", data)
        self.assertGreater(len(data["blue_land"]["polygon"]), 2)
        self.assertGreater(len(data["red_land"]["polygon"]), 2)

    def test_07_plan_lifecycle(self):
        # Save plan
        save_payload = {
            "name": "OPERATION INTEGRATION TEST",
            "units": [
                {"id": "test_plt_1", "name": "Platoon Test", "coords": [500, 500]}
            ],
            "territories": {"blue": [[100, 100], [200, 100], [200, 200]]}
        }
        save_resp = self.client.post('/api/plan/save', json=save_payload)
        self.assertEqual(save_resp.status_code, 200)
        save_data = json.loads(save_resp.data)
        self.assertEqual(save_data["status"], "success")
        plan_id = save_data["plan_id"]

        # Load plan
        load_resp = self.client.get(f'/api/plan/load?id={plan_id}')
        self.assertEqual(load_resp.status_code, 200)
        load_data = json.loads(load_resp.data)
        self.assertEqual(load_data["name"], "OPERATION INTEGRATION TEST")
        self.assertEqual(len(load_data["units"]), 1)

        # Clear plan
        clear_resp = self.client.post('/api/plan/clear')
        self.assertEqual(clear_resp.status_code, 200)


if __name__ == "__main__":
    unittest.main()
