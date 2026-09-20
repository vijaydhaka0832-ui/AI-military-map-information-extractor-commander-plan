"""
Operational Startup Script for AI Base Information Extractor & Commander Tactical Planner.
Launches the Flask Tactical Intelligence server on http://127.0.0.1:5000
"""

import sys
import os
import webbrowser
from app import app

if __name__ == "__main__":
    port = 5000
    host = "127.0.0.1"
    url = f"http://{host}:{port}"

    print("=" * 72)
    print("  AI BASE INFORMATION EXTRACTOR & COMMANDER TACTICAL PLANNER")
    print("  Military Topographical Intelligence & Operational Decision Engine")
    print("=" * 72)
    print(f"  [+] Tactical Server URL : {url}")
    print("  [+] Topo Grid System    : UTM Zone 45R (Scale 1:50,000)")
    print("  [+] AI Extraction Engine: Roads, Rivers, Bridges, Railway, Ponds, Hills")
    print("  [+] Interactive Mode    : Right-Click GR Inspection (6-fig & 8-fig)")
    print("  [+] Commander Planning  : Platoon Pathing, Distance Math & Territory")
    print("=" * 72)
    print("  Press Ctrl+C to terminate the tactical command server.\n")

    # Launch server
    app.run(host=host, port=port, debug=False)
