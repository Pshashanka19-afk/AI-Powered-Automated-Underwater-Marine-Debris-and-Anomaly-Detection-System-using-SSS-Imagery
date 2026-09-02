"""
Qorvia - Video Demo Generator (Planetary All-Oceans & APIs Edition)
Renders a 1080p 60fps video walkthrough showcasing all global oceans, live telemetry APIs, and Gemini AI.
"""

import os
import math
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

WIDTH = 1920
HEIGHT = 1080
FPS = 30

FONT_DIR = "fonts"
F_TITLE_L = ImageFont.truetype(os.path.join(FONT_DIR, "SpaceGrotesk.ttf"), 46)
F_TITLE_M = ImageFont.truetype(os.path.join(FONT_DIR, "SpaceGrotesk.ttf"), 32)
F_TITLE_S = ImageFont.truetype(os.path.join(FONT_DIR, "SpaceGrotesk.ttf"), 22)

F_BODY_L = ImageFont.truetype(os.path.join(FONT_DIR, "Manrope.ttf"), 26)
F_BODY_M = ImageFont.truetype(os.path.join(FONT_DIR, "Manrope.ttf"), 20)
F_BODY_S = ImageFont.truetype(os.path.join(FONT_DIR, "Manrope.ttf"), 16)
F_BODY_XS = ImageFont.truetype(os.path.join(FONT_DIR, "Manrope.ttf"), 13)

F_MONO_M = ImageFont.truetype(os.path.join(FONT_DIR, "IBMPlexMono.ttf"), 18)
F_MONO_S = ImageFont.truetype(os.path.join(FONT_DIR, "IBMPlexMono.ttf"), 15)
F_MONO_XS = ImageFont.truetype(os.path.join(FONT_DIR, "IBMPlexMono.ttf"), 12)
F_MONO_BOLD = ImageFont.truetype(os.path.join(FONT_DIR, "IBMPlexMono-Bold.ttf"), 18)

# Colors
BG_DARK = (7, 13, 24)
BORDER_CYAN = (0, 240, 255, 120)
BORDER_SLATE = (56, 189, 248, 60)
CYAN_ACCENT = (0, 240, 255)
BLUE_ACCENT = (2, 132, 199)
GREEN_ACCENT = (16, 185, 129)
YELLOW_ACCENT = (245, 158, 11)
RED_ACCENT = (239, 68, 68)
TEXT_WHITE = (248, 250, 252)
TEXT_MUTED = (148, 163, 184)
TEXT_DIM = (100, 116, 139)

def create_base_canvas():
    return Image.new("RGBA", (WIDTH, HEIGHT), BG_DARK)

def draw_header(draw, active_nav="map"):
    draw.rectangle([0, 0, WIDTH, 75], fill=(10, 20, 38, 245), outline=BORDER_SLATE, width=1)

    # Logo
    draw.rounded_rectangle([30, 15, 75, 60], radius=10, fill=(8, 18, 38), outline=CYAN_ACCENT, width=2)
    draw.ellipse([42, 27, 63, 48], outline=CYAN_ACCENT, width=2)
    draw.line([36, 37, 69, 37], fill=CYAN_ACCENT, width=2)
    draw.line([52, 21, 52, 54], fill=CYAN_ACCENT, width=2)

    draw.text((90, 18), "QORVIA", font=F_TITLE_M, fill=TEXT_WHITE)
    draw.text((360, 26), "for the next generation", font=F_MONO_XS, fill=CYAN_ACCENT)
    draw.rounded_rectangle([350, 24, 520, 45], radius=4, outline=CYAN_ACCENT, width=1)
    draw.text((92, 48), "All-Oceans Marine Debris & Live Telemetry APIs (Gemini Vision + Open-Meteo)", font=F_BODY_XS, fill=TEXT_MUTED)

    # Status badges
    draw.rounded_rectangle([720, 20, 970, 55], radius=8, fill=(15, 30, 55), outline=BORDER_SLATE, width=1)
    draw.ellipse([735, 33, 745, 43], fill=GREEN_ACCENT)
    draw.text((755, 27), "ALL 7 OCEANS LIVE", font=F_MONO_S, fill=TEXT_WHITE)

    draw.rounded_rectangle([990, 20, 1230, 55], radius=8, fill=(2, 132, 199, 50), outline=CYAN_ACCENT, width=1)
    draw.text((1005, 27), "GEMINI VISION API: ACTIVE", font=F_MONO_S, fill=CYAN_ACCENT)

    draw.rounded_rectangle([1250, 20, 1460, 55], radius=8, fill=(15, 30, 55), outline=BORDER_SLATE, width=1)
    draw.text((1265, 27), "MAGNIFIER LOUPE", font=F_MONO_S, fill=TEXT_WHITE)

    draw.rounded_rectangle([1480, 20, 1640, 55], radius=8, fill=(15, 30, 55), outline=BORDER_SLATE, width=1)
    draw.text((1495, 27), "FILTERS (beside compass)", font=F_MONO_S, fill=CYAN_ACCENT)

    # Menu button now lives on the left edge of the map, not the header
    draw.rounded_rectangle([1830, 15, 1885, 60], radius=10, fill=(15, 30, 55), outline=CYAN_ACCENT, width=1)
    for y_offset in [26, 36, 46]:
        draw.line([1845, y_offset, 1870, y_offset], fill=TEXT_WHITE, width=2)
    draw.text((1780, 27), "MENU (map-left)", font=F_MONO_XS, fill=TEXT_MUTED)

def draw_map_section(draw, t, selected_ocean="PAC", show_magnifier=False, mag_pos=(520, 420)):
    map_x, map_y, map_w, map_h = 30, 95, 1180, 680
    draw.rounded_rectangle([map_x, map_y, map_x + map_w, map_y + map_h], radius=16, fill=(5, 12, 24), outline=BORDER_SLATE, width=2)

    # Map Header
    draw.rounded_rectangle([map_x, map_y, map_x + map_w, map_y + 45], radius=14, fill=(10, 22, 42))
    draw.rounded_rectangle([map_x + 15, map_y + 10, map_x + 40, map_y + 35], radius=4, fill=(0, 240, 255, 40))
    draw.text((map_x + 22, map_y + 12), "B", font=F_MONO_BOLD, fill=CYAN_ACCENT)
    draw.text((map_x + 55, map_y + 12), "Global Multi-Ocean Telemetry & Heatmap Hotspots", font=F_TITLE_S, fill=TEXT_WHITE)

    # Global Ocean Jump Tabs
    tabs = [("🌐 Global", 460), ("🌊 Pacific (GPGP)", 560), ("🧭 Atlantic", 700), ("⚓ Indian", 820), ("❄️ Arctic", 920), ("🏔️ Southern", 1015)]
    for name, rx in tabs:
        draw.rounded_rectangle([rx, map_y + 8, rx + 90 if "Global" in name else rx + 110, map_y + 36], radius=6, fill=(18, 35, 65), outline=BORDER_SLATE, width=1)
        draw.text((rx + 8, map_y + 12), name, font=F_MONO_XS, fill=CYAN_ACCENT if selected_ocean in name else TEXT_MUTED)

    # World Continents & Oceanic Basins
    draw.polygon([(map_x + 80, map_y + 120), (map_x + 220, map_y + 150), (map_x + 180, map_y + 320), (map_x + 120, map_y + 250)], fill=(18, 30, 48)) # N America
    draw.polygon([(map_x + 180, map_y + 350), (map_x + 260, map_y + 420), (map_x + 220, map_y + 580), (map_x + 170, map_y + 460)], fill=(18, 30, 48)) # S America
    draw.polygon([(map_x + 450, map_y + 100), (map_x + 650, map_y + 110), (map_x + 600, map_y + 300), (map_x + 480, map_y + 280)], fill=(18, 30, 48)) # Europe
    draw.polygon([(map_x + 460, map_y + 300), (map_x + 600, map_y + 320), (map_x + 560, map_y + 540), (map_x + 480, map_y + 520)], fill=(18, 30, 48)) # Africa
    draw.polygon([(map_x + 650, map_y + 110), (map_x + 980, map_y + 130), (map_x + 920, map_y + 380), (map_x + 720, map_y + 350)], fill=(18, 30, 48)) # Asia
    draw.polygon([(map_x + 880, map_y + 440), (map_x + 1020, map_y + 460), (map_x + 980, map_y + 580), (map_x + 860, map_y + 540)], fill=(18, 30, 48)) # Australia

    # Ocean Watermark Labels
    draw.text((map_x + 240, map_y + 240), "PACIFIC (GPGP)", font=F_TITLE_S, fill=(0, 240, 255, 70))
    draw.text((map_x + 320, map_y + 320), "NORTH ATLANTIC", font=F_TITLE_S, fill=(0, 240, 255, 70))
    draw.text((map_x + 680, map_y + 440), "INDIAN OCEAN", font=F_TITLE_S, fill=(0, 240, 255, 70))
    draw.text((map_x + 520, map_y + 80), "ARCTIC (POLAR)", font=F_TITLE_S, fill=(0, 240, 255, 70))
    draw.text((map_x + 340, map_y + 610), "SOUTHERN OCEAN", font=F_TITLE_S, fill=(0, 240, 255, 70))

    # Grid lines
    for gx in range(map_x + 100, map_x + map_w, 160):
        draw.line([gx, map_y + 45, gx, map_y + map_h], fill=(56, 189, 248, 25), width=1)
    for gy in range(map_y + 80, map_y + map_h, 120):
        draw.line([map_x, gy, map_x + map_w, gy], fill=(56, 189, 248, 25), width=1)

    # Compass Rose beside Filter toggle + Live Open-Meteo Marine Telemetry HUD (bottom-left in the live app)
    draw.rounded_rectangle([map_x + 25, map_y + 60, map_x + 80, map_y + 125], radius=8, fill=(12, 24, 45, 200), outline=BORDER_CYAN, width=1)
    draw.text((map_x + 45, map_y + 68), "▲", font=F_BODY_S, fill=CYAN_ACCENT)
    draw.text((map_x + 47, map_y + 90), "N", font=F_MONO_BOLD, fill=TEXT_WHITE)
    draw.rounded_rectangle([map_x + 90, map_y + 60, map_x + 190, map_y + 125], radius=8, fill=(12, 24, 45, 200), outline=BORDER_CYAN, width=1)
    draw.text((map_x + 105, map_y + 85), "Filters", font=F_MONO_S, fill=CYAN_ACCENT)

    # Live Marine API HUD (now rendered bottom-left of the map)
    draw.rounded_rectangle([map_x + 25, map_y + map_h - 90, map_x + 340, map_y + map_h - 15], radius=10, fill=(12, 24, 45, 220), outline=BORDER_CYAN, width=1)
    draw.text((map_x + 40, map_y + map_h - 80), "LAT: 32.4500° N | LON: -145.2000° W", font=F_MONO_S, fill=TEXT_WHITE)
    draw.line([map_x + 40, map_y + map_h - 56, map_x + 325, map_y + map_h - 56], fill=BORDER_SLATE, width=1)
    draw.text((map_x + 40, map_y + map_h - 46), "🌊 Wave: 1.8m  ⚡ Cur: 1.4 kt  🌡️ 24.2°C (Regional)", font=F_MONO_XS, fill=GREEN_ACCENT)

    # Heatmap Risk Legend
    draw.rounded_rectangle([map_x + map_w - 340, map_y + 60, map_x + map_w - 25, map_y + 115], radius=8, fill=(12, 24, 45, 220), outline=BORDER_CYAN, width=1)
    draw.text((map_x + map_w - 325, map_y + 68), "GLOBAL GYRE RISK SCALE", font=F_MONO_XS, fill=TEXT_MUTED)
    draw.ellipse([map_x + map_w - 325, map_y + 92, map_x + map_w - 315, map_y + 102], fill=RED_ACCENT)
    draw.text((map_x + map_w - 310, map_y + 88), "Red: High (3-4 rings)", font=F_MONO_XS, fill=TEXT_WHITE)
    draw.ellipse([map_x + map_w - 225, map_y + 92, map_x + map_w - 215, map_y + 102], fill=YELLOW_ACCENT)
    draw.text((map_x + map_w - 210, map_y + 88), "Med (2-3 rings)", font=F_MONO_XS, fill=TEXT_WHITE)
    draw.ellipse([map_x + map_w - 130, map_y + 92, map_x + map_w - 120, map_y + 102], fill=GREEN_ACCENT)
    draw.text((map_x + map_w - 115, map_y + 88), "Low (1-2 rings)", font=F_MONO_XS, fill=TEXT_WHITE)

    # 1. Great Pacific Garbage Patch (GPGP) Hotspot with concentric zoom rings
    p_gpgp = (map_x + 280, map_y + 260)
    pulse = int(18 + 8 * math.sin(t * 5))
    draw.ellipse([p_gpgp[0] - 80, p_gpgp[1] - 80, p_gpgp[0] + 80, p_gpgp[1] + 80], fill=(239, 68, 68, 45), outline=RED_ACCENT, width=1)
    for ring_i in range(1, 5):
        rr = pulse + ring_i * 14
        draw.ellipse([p_gpgp[0] - rr, p_gpgp[1] - rr, p_gpgp[0] + rr, p_gpgp[1] + rr], outline=RED_ACCENT, width=1)
    draw.ellipse([p_gpgp[0] - 8, p_gpgp[1] - 8, p_gpgp[0] + 8, p_gpgp[1] + 8], fill=RED_ACCENT, outline=(255, 255, 255), width=2)

    # Popup on GPGP Target
    draw.rounded_rectangle([p_gpgp[0] + 20, p_gpgp[1] - 120, p_gpgp[0] + 270, p_gpgp[1] + 45], radius=10, fill=(10, 20, 38, 245), outline=CYAN_ACCENT, width=2)
    draw.text((p_gpgp[0] + 35, p_gpgp[1] - 110), "#P0101 - GPGP Core", font=F_MONO_BOLD, fill=CYAN_ACCENT)
    draw.text((p_gpgp[0] + 35, p_gpgp[1] - 88), "Mega Ghost Net & Trawl Array", font=F_BODY_S, fill=TEXT_WHITE)
    draw.text((p_gpgp[0] + 35, p_gpgp[1] - 68), "Risk - Conf: 96.8% - HIGH", font=F_MONO_XS, fill=RED_ACCENT)
    draw.text((p_gpgp[0] + 35, p_gpgp[1] - 50), "Coords: 32.45° N, -145.20° W", font=F_MONO_XS, fill=TEXT_MUTED)
    draw.text((p_gpgp[0] + 35, p_gpgp[1] - 32), "Depth: 25m | Est: ~1,450 kg", font=F_MONO_XS, fill=CYAN_ACCENT)

    # Popup buttons
    draw.rounded_rectangle([p_gpgp[0] + 35, p_gpgp[1] - 10, p_gpgp[0] + 130, p_gpgp[1] + 15], radius=4, fill=BLUE_ACCENT)
    draw.text((p_gpgp[0] + 45, p_gpgp[1] - 8), "View Sensor", font=F_MONO_XS, fill=TEXT_WHITE)
    draw.rounded_rectangle([p_gpgp[0] + 140, p_gpgp[1] - 10, p_gpgp[0] + 190, p_gpgp[1] + 15], radius=4, fill=(30, 45, 75))
    draw.text((p_gpgp[0] + 150, p_gpgp[1] - 8), "CSV", font=F_MONO_XS, fill=TEXT_WHITE)
    draw.rounded_rectangle([p_gpgp[0] + 200, p_gpgp[1] - 10, p_gpgp[0] + 250, p_gpgp[1] + 15], radius=4, fill=(30, 45, 75))
    draw.text((p_gpgp[0] + 210, p_gpgp[1] - 8), "JSON", font=F_MONO_XS, fill=TEXT_WHITE)

    # 2. Sargasso Sea (Atlantic)
    p_sar = (map_x + 360, map_y + 310)
    draw.ellipse([p_sar[0] - 50, p_sar[1] - 50, p_sar[0] + 50, p_sar[1] + 50], fill=(239, 68, 68, 35), outline=RED_ACCENT, width=1)
    draw.ellipse([p_sar[0] - 7, p_sar[1] - 7, p_sar[0] + 7, p_sar[1] + 7], fill=RED_ACCENT, outline=(255, 255, 255), width=2)
    draw.text((p_sar[0] + 15, p_sar[1] - 10), "#A0201 (94.5%)", font=F_MONO_XS, fill=TEXT_WHITE)

    # 3. Indian Ocean (Arabian Sea / Bay of Bengal cluster — 20 nodes live here)
    p_ind = (map_x + 720, map_y + 360)
    draw.ellipse([p_ind[0] - 50, p_ind[1] - 50, p_ind[0] + 50, p_ind[1] + 50], fill=(239, 68, 68, 35), outline=RED_ACCENT, width=1)
    draw.ellipse([p_ind[0] - 7, p_ind[1] - 7, p_ind[0] + 7, p_ind[1] + 7], fill=RED_ACCENT, outline=(255, 255, 255), width=2)
    draw.text((p_ind[0] + 15, p_ind[1] - 10), "#AS100 (94.2%)", font=F_MONO_XS, fill=TEXT_WHITE)

    # 4. Arctic Ocean (Barents Sea)
    p_arc = (map_x + 580, map_y + 120)
    draw.ellipse([p_arc[0] - 40, p_arc[1] - 40, p_arc[0] + 40, p_arc[1] + 40], fill=(245, 158, 11, 40), outline=YELLOW_ACCENT, width=1)
    draw.ellipse([p_arc[0] - 6, p_arc[1] - 6, p_arc[0] + 6, p_arc[1] + 6], fill=YELLOW_ACCENT, outline=(255, 255, 255), width=2)

    # 5. Southern Ocean (Drake Passage)
    p_sou = (map_x + 320, map_y + 600)
    draw.ellipse([p_sou[0] - 45, p_sou[1] - 45, p_sou[0] + 45, p_sou[1] + 45], fill=(239, 68, 68, 40), outline=RED_ACCENT, width=1)
    draw.ellipse([p_sou[0] - 7, p_sou[1] - 7, p_sou[0] + 7, p_sou[1] + 7], fill=RED_ACCENT, outline=(255, 255, 255), width=2)

    # Magnifier
    if show_magnifier:
        mx, my = mag_pos
        draw.ellipse([mx - 75, my - 75, mx + 75, my + 75], fill=(8, 28, 55, 230), outline=CYAN_ACCENT, width=3)
        draw.line([mx - 70, my, mx + 70, my], fill=(0, 240, 255, 150), width=1)
        draw.line([mx, my - 70, mx, my + 70], fill=(0, 240, 255, 150), width=1)
        for k in range(-30, 31, 15):
            draw.arc([mx + k - 20, my - 30, mx + k + 20, my + 30], 0, 180, fill=RED_ACCENT, width=2)
        draw.text((mx - 40, my + 45), "2.5x ZOOM", font=F_MONO_XS, fill=CYAN_ACCENT)

    # Bottom Target Detail Card
    card_y = 790
    draw.rounded_rectangle([map_x, card_y, map_x + map_w, card_y + 120], radius=14, fill=(12, 24, 44, 235), outline=BORDER_CYAN, width=1)
    draw.rounded_rectangle([map_x + 20, card_y + 20, map_x + 95, card_y + 95], radius=10, fill=(8, 18, 36), outline=CYAN_ACCENT, width=1)
    draw.text((map_x + 28, card_y + 45), "#P0101", font=F_MONO_BOLD, fill=CYAN_ACCENT)

    draw.text((map_x + 115, card_y + 22), "Target #P0101 - Great Pacific Garbage Patch (GPGP Core)", font=F_TITLE_S, fill=TEXT_WHITE)
    draw.rounded_rectangle([map_x + 720, card_y + 22, map_x + 890, card_y + 48], radius=6, fill=(239, 68, 68, 40), outline=RED_ACCENT, width=1)
    draw.text((map_x + 730, card_y + 26), "RISK: HIGH (96.8%)", font=F_MONO_S, fill=RED_ACCENT)

    draw.text((map_x + 115, card_y + 60), "Global Coords: 32.4500° N, -145.2000° W", font=F_MONO_S, fill=TEXT_MUTED)
    draw.text((map_x + 510, card_y + 60), "Depth: 25m", font=F_MONO_S, fill=CYAN_ACCENT)
    draw.text((map_x + 640, card_y + 60), "Ocean: North Pacific Gyre", font=F_MONO_S, fill=TEXT_WHITE)
    draw.text((map_x + 115, card_y + 88), "Telemetry Sensor: Sentinel-2 SWIR & NOAA Ocean Buoy 46006", font=F_BODY_XS, fill=TEXT_DIM)

    # Action Buttons
    draw.rounded_rectangle([map_x + 910, card_y + 35, map_x + 1030, card_y + 85], radius=8, fill=BLUE_ACCENT)
    draw.text((map_x + 925, card_y + 50), "View Sensor", font=F_MONO_S, fill=TEXT_WHITE)
    draw.rounded_rectangle([map_x + 1045, card_y + 35, map_x + 1105, card_y + 85], radius=8, fill=(20, 35, 60), outline=BORDER_SLATE, width=1)
    draw.text((map_x + 1060, card_y + 50), "CSV", font=F_MONO_S, fill=TEXT_WHITE)
    draw.rounded_rectangle([map_x + 1115, card_y + 35, map_x + 1170, card_y + 85], radius=8, fill=(20, 35, 60), outline=BORDER_SLATE, width=1)
    draw.text((map_x + 1128, card_y + 50), "JSON", font=F_MONO_S, fill=TEXT_WHITE)

def draw_upload_panel(draw, state="upload", progress=0, status_text="", subtext=""):
    px, py, pw, ph = 1240, 95, 650, 815
    draw.rounded_rectangle([px, py, px + pw, py + ph], radius=16, fill=(12, 24, 44, 240), outline=BORDER_SLATE, width=2)

    if state == "upload":
        draw.rounded_rectangle([px + 15, py + 15, px + 40, py + 40], radius=4, fill=(0, 240, 255, 40))
        draw.text((px + 22, py + 18), "A", font=F_MONO_BOLD, fill=CYAN_ACCENT)
        draw.text((px + 55, py + 18), "Add Files from Computer [A]", font=F_TITLE_S, fill=TEXT_WHITE)
        draw.text((px + 20, py + 55), "* JSON, CSV, GeoJSON, PNG, JPG & GeoTIFF Supported", font=F_MONO_S, fill=CYAN_ACCENT)

        draw.rounded_rectangle([px + 25, py + 95, px + pw - 25, py + 280], radius=12, fill=(8, 16, 32), outline=CYAN_ACCENT, width=2)
        draw.ellipse([px + pw//2 - 35, py + 125, px + pw//2 + 35, py + 195], fill=(0, 240, 255, 30), outline=CYAN_ACCENT, width=1)
        draw.text((px + pw//2 - 12, py + 145), "▲", font=F_TITLE_S, fill=CYAN_ACCENT)
        draw.text((px + pw//2 - 130, py + 215), "Drag & Drop Planetary Telemetry File", font=F_BODY_M, fill=TEXT_WHITE)
        draw.text((px + pw//2 - 90, py + 245), "or click to browse local files", font=F_BODY_S, fill=TEXT_MUTED)

        draw.text((px + 25, py + 310), "OR LOAD GLOBAL OCEAN DATASETS:", font=F_MONO_S, fill=TEXT_MUTED)

        draw.rounded_rectangle([px + 25, py + 340, px + pw - 25, py + 420], radius=10, fill=(18, 32, 58), outline=BORDER_SLATE, width=1)
        draw.text((px + 45, py + 355), "🛰️ Qorvia GPGP Marine Tile #P0101", font=F_BODY_M, fill=TEXT_WHITE)
        draw.text((px + 45, py + 385), "GeoTIFF • 4.8 MB • North Pacific Gyre", font=F_MONO_S, fill=CYAN_ACCENT)
        draw.text((px + pw - 90, py + 370), "LOAD ➔", font=F_MONO_S, fill=CYAN_ACCENT)

        draw.rounded_rectangle([px + 25, py + 450, px + pw - 25, py + 680], radius=12, fill=(8, 18, 36), outline=CYAN_ACCENT, width=2)
        draw.text((px + 45, py + 470), "FILE PREVIEW (Wireframe A)", font=F_MONO_BOLD, fill=CYAN_ACCENT)

        draw.rounded_rectangle([px + 45, py + 505, px + pw - 45, py + 590], radius=8, fill=(15, 28, 50))
        draw.text((px + 60, py + 520), "File   : Qorvia_GPGP_Core_0101.tif", font=F_MONO_S, fill=TEXT_WHITE)
        draw.text((px + 60, py + 542), "Format : GEOTIFF (Multispectral SWIR)", font=F_MONO_S, fill=CYAN_ACCENT)
        draw.text((px + 60, py + 564), "Size   : 4.8 MB", font=F_MONO_S, fill=CYAN_ACCENT)

        draw.text((px + 120, py + 610), "Do you want to upload and analyze it?", font=F_BODY_M, fill=TEXT_WHITE)

        draw.rounded_rectangle([px + 80, py + 645, px + 260, py + 695], radius=8, fill=(25, 38, 60), outline=BORDER_SLATE, width=1)
        draw.text((px + 130, py + 660), "✕ Cancel", font=F_BODY_S, fill=TEXT_MUTED)

        draw.rounded_rectangle([px + 300, py + 645, px + 520, py + 695], radius=8, fill=BLUE_ACCENT)
        draw.text((px + 340, py + 660), "✓ Upload & Analyze", font=F_BODY_S, fill=TEXT_WHITE)

    elif state == "processing":
        draw.rounded_rectangle([px + 15, py + 15, px + 120, py + 40], radius=4, fill=(245, 158, 11, 40))
        draw.text((px + 22, py + 18), "PROCESSING", font=F_MONO_BOLD, fill=YELLOW_ACCENT)
        draw.text((px + 140, py + 18), "Gemini Vision AI & Telemetry", font=F_TITLE_S, fill=TEXT_WHITE)
        draw.text((px + pw - 100, py + 18), "00:05", font=F_MONO_BOLD, fill=CYAN_ACCENT)

        cx, cy = px + pw//2, py + 220
        draw.ellipse([cx - 90, cy - 90, cx + 90, cy + 90], outline=BORDER_CYAN, width=2)
        draw.ellipse([cx - 50, cy - 50, cx + 50, cy + 50], fill=(10, 22, 42), outline=CYAN_ACCENT, width=2)
        sweep_angle = (progress * 3.6) * math.pi / 180
        draw.line([cx, cy, cx + 80 * math.cos(sweep_angle), cy + 80 * math.sin(sweep_angle)], fill=CYAN_ACCENT, width=3)

        draw.text((cx - 200, py + 340), status_text, font=F_TITLE_S, fill=CYAN_ACCENT)
        draw.text((cx - 180, py + 380), subtext, font=F_BODY_S, fill=TEXT_MUTED)

        draw.rounded_rectangle([px + 50, py + 440, px + pw - 50, py + 465], radius=12, fill=(8, 18, 36), outline=BORDER_SLATE, width=1)
        bar_w = int((pw - 100) * (progress / 100))
        if bar_w > 0:
            draw.rounded_rectangle([px + 50, py + 440, px + 50 + bar_w, py + 465], radius=12, fill=CYAN_ACCENT)

        draw.text((px + 50, py + 480), "0%", font=F_MONO_S, fill=TEXT_MUTED)
        draw.text((px + pw//2 - 20, py + 480), f"{int(progress)}%", font=F_MONO_BOLD, fill=CYAN_ACCENT)
        draw.text((px + pw - 90, py + 480), "100%", font=F_MONO_S, fill=TEXT_MUTED)

        draw.rounded_rectangle([px + 40, py + 540, px + pw - 40, py + 680], radius=10, fill=(8, 16, 32))
        draw.text((px + 60, py + 560), "• AI Model API : Google Gemini 1.5/2.0 Vision Multimodal", font=F_MONO_S, fill=CYAN_ACCENT)
        draw.text((px + 60, py + 590), "• Ocean API    : Open-Meteo Live Marine Telemetry", font=F_MONO_S, fill=TEXT_WHITE)
        draw.text((px + 60, py + 620), "• Basemap API  : Esri High-Resolution World Imagery", font=F_MONO_S, fill=TEXT_WHITE)
        draw.text((px + 60, py + 650), "• Coverage     : Pacific, Atlantic, Indian, Arctic, Southern", font=F_MONO_S, fill=YELLOW_ACCENT)

    elif state == "complete":
        draw.rounded_rectangle([px + 15, py + 15, px + 120, py + 40], radius=4, fill=(16, 185, 129, 40))
        draw.text((px + 22, py + 18), "COMPLETE", font=F_MONO_BOLD, fill=GREEN_ACCENT)
        draw.text((px + 140, py + 18), "Global Analysis Complete", font=F_TITLE_S, fill=TEXT_WHITE)

        draw.rounded_rectangle([px + 25, py + 65, px + pw - 25, py + 145], radius=10, fill=(6, 44, 30), outline=GREEN_ACCENT, width=1)
        draw.text((px + 45, py + 80), "✓ 7 Potential Marine Hazards Detected", font=F_TITLE_S, fill=GREEN_ACCENT)
        draw.text((px + 45, py + 115), "⚡ 2 Critical GPGP Ghost Nets Flagged for Ocean Cleanup Fleet", font=F_BODY_S, fill=YELLOW_ACCENT)

        draw.text((px + 25, py + 165), "AI DETECTION BREAKDOWN (Wireframe A)", font=F_MONO_S, fill=TEXT_MUTED)

        draw.rounded_rectangle([px + 25, py + 195, px + pw - 25, py + 420], radius=10, fill=(5, 15, 30), outline=CYAN_ACCENT, width=1)
        for y in range(py + 215, py + 410, 25):
            draw.line([px + 35, y, px + pw - 35, y + 8], fill=(0, 240, 255, 40), width=1)

        draw.rectangle([px + 180, py + 230, px + 350, py + 340], outline=RED_ACCENT, width=2)
        draw.rectangle([px + 180, py + 205, px + 280, py + 230], fill=RED_ACCENT)
        draw.text((px + 185, py + 210), "Debris: 94%", font=F_MONO_XS, fill=TEXT_WHITE)

        draw.rectangle([px + 400, py + 280, px + 540, py + 390], outline=YELLOW_ACCENT, width=2)
        draw.rectangle([px + 400, py + 255, px + 510, py + 280], fill=YELLOW_ACCENT)
        draw.text((px + 405, py + 260), "Ghost Net: 41%", font=F_MONO_XS, fill=(0, 0, 0))

        draw.rounded_rectangle([px + 25, py + 440, px + 215, py + 520], radius=8, fill=(40, 10, 15), outline=RED_ACCENT, width=1)
        draw.text((px + 70, py + 450), "DEBRIS", font=F_MONO_S, fill=RED_ACCENT)
        draw.text((px + 80, py + 475), "94%", font=F_TITLE_M, fill=RED_ACCENT)

        draw.rounded_rectangle([px + 235, py + 440, px + 425, py + 520], radius=8, fill=(40, 30, 10), outline=YELLOW_ACCENT, width=1)
        draw.text((px + 270, py + 450), "GHOST NET", font=F_MONO_S, fill=YELLOW_ACCENT)
        draw.text((px + 295, py + 475), "41%", font=F_TITLE_M, fill=YELLOW_ACCENT)

        draw.rounded_rectangle([px + 445, py + 440, px + pw - 25, py + 520], radius=8, fill=(10, 35, 20), outline=GREEN_ACCENT, width=1)
        draw.text((px + 480, py + 450), "OTHER", font=F_MONO_S, fill=GREEN_ACCENT)
        draw.text((px + 505, py + 475), "21%", font=F_TITLE_M, fill=GREEN_ACCENT)

        draw.text((px + 25, py + 550), "DOWNLOAD FORMATS (Wireframe A):", font=F_MONO_S, fill=TEXT_WHITE)

        draw.rounded_rectangle([px + 25, py + 580, px + 215, py + 640], radius=8, fill=(20, 35, 65), outline=CYAN_ACCENT, width=1)
        draw.text((px + 65, py + 600), "📥 CSV Report", font=F_BODY_M, fill=CYAN_ACCENT)

        draw.rounded_rectangle([px + 235, py + 580, px + 425, py + 640], radius=8, fill=(20, 35, 65), outline=CYAN_ACCENT, width=1)
        draw.text((px + 275, py + 600), "📥 GeoJSON", font=F_BODY_M, fill=CYAN_ACCENT)

        draw.rounded_rectangle([px + 445, py + 580, px + pw - 25, py + 640], radius=8, fill=(20, 35, 65), outline=CYAN_ACCENT, width=1)
        draw.text((px + 485, py + 600), "📄 PDF Summary", font=F_BODY_M, fill=CYAN_ACCENT)

        draw.rounded_rectangle([px + 25, py + 670, px + pw - 25, py + 730], radius=8, fill=BLUE_ACCENT)
        draw.text((px + pw//2 - 80, py + 690), "🗺️ Highlighted on Map", font=F_BODY_M, fill=TEXT_WHITE)

def draw_animated_cursor(draw, pos, click_anim=0):
    cx, cy = pos
    if click_anim > 0:
        cr = int(click_anim * 25)
        draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], outline=CYAN_ACCENT, width=2)
    cursor_pts = [(cx, cy), (cx, cy + 24), (cx + 6, cy + 18), (cx + 16, cy + 24), (cx + 20, cy + 16), (cx + 10, cy + 12), (cx + 18, cy + 8)]
    draw.polygon(cursor_pts, fill=(255, 255, 255), outline=(0, 0, 0))

def render_demo_video(output_path="demo_video.mp4"):
    print(f"Starting rendering of {output_path} (1080p Qorvia Edition @ {FPS} fps)...")

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, float(FPS), (WIDTH, HEIGHT))

    total_duration = 32.0
    total_frames = int(total_duration * FPS)

    for frame_idx in range(total_frames):
        t = frame_idx / FPS
        base_img = create_base_canvas()
        draw = ImageDraw.Draw(base_img)

        # SCENE 1: Splash Screen (0s - 4.5s) — logo alone for 2s, then tagline
        if t < 4.5:
            for ring_idx in range(3):
                wave_t = (t + ring_idx * 0.8) % 2.5
                wave_r = int(wave_t * 220)
                wave_alpha = int(max(0, 255 * (1.0 - wave_t / 2.5)))
                draw.ellipse([WIDTH//2 - wave_r, HEIGHT//2 - wave_r, WIDTH//2 + wave_r, HEIGHT//2 + wave_r], outline=(0, 240, 255, wave_alpha), width=2)

            draw.rounded_rectangle([WIDTH//2 - 75, HEIGHT//2 - 180, WIDTH//2 + 75, HEIGHT//2 - 30], radius=20, fill=(8, 20, 42), outline=CYAN_ACCENT, width=3)
            draw.ellipse([WIDTH//2 - 35, HEIGHT//2 - 140, WIDTH//2 + 35, HEIGHT//2 - 70], outline=CYAN_ACCENT, width=3)
            draw.line([WIDTH//2 - 50, HEIGHT//2 - 105, WIDTH//2 + 50, HEIGHT//2 - 105], fill=CYAN_ACCENT, width=2)
            draw.line([WIDTH//2, HEIGHT//2 - 155, WIDTH//2, HEIGHT//2 - 55], fill=CYAN_ACCENT, width=2)

            draw.text((WIDTH//2 - 130, HEIGHT//2), "QORVIA", font=F_TITLE_L, fill=TEXT_WHITE)

            if t >= 2.0:
                # tagline reveals under the "R" of QORVIA after 2 seconds
                draw.text((WIDTH//2 - 20, HEIGHT//2 + 55), "for the next generation", font=F_BODY_L, fill=(207, 250, 254))

            progress_pct = min(1.0, t / 4.5)
            draw.rounded_rectangle([WIDTH//2 - 180, HEIGHT//2 + 200, WIDTH//2 + 180, HEIGHT//2 + 212], radius=6, fill=(20, 35, 60))
            draw.rounded_rectangle([WIDTH//2 - 180, HEIGHT//2 + 200, int(WIDTH//2 - 180 + 360 * progress_pct), HEIGHT//2 + 212], radius=6, fill=CYAN_ACCENT)

        # SCENE 2: Global Map & Pacific GPGP Hotspot (4.5s - 12.0s)
        elif t < 12.0:
            draw_header(draw, active_nav="map")
            show_mag = (t >= 8.5 and t < 12.0)
            draw_map_section(draw, t, selected_ocean="PAC", show_magnifier=show_mag, mag_pos=(310, 290))
            draw_upload_panel(draw, state="upload")

            cur_x = int(100 + (310 - 100) * min(1.0, (t - 4.5) / 2.0))
            cur_y = int(100 + (290 - 100) * min(1.0, (t - 4.5) / 2.0))
            click_anim = max(0, 1.0 - (t - 6.5) * 3) if 6.5 <= t <= 7.0 else 0
            draw_animated_cursor(draw, (cur_x, cur_y), click_anim)

        # SCENE 3: Global Ocean Selector Navigation (12.0s - 15.5s)
        elif t < 15.5:
            draw_header(draw, active_nav="map")
            draw_map_section(draw, t, selected_ocean="ATL")
            draw_upload_panel(draw, state="upload")

            cur_x = int(600 + 100 * math.sin(t * 2))
            cur_y = int(115)
            draw_animated_cursor(draw, (cur_x, cur_y), 0)

        # SCENE 4: File Upload & Live Gemini 5-Sec AI Pipeline (15.5s - 22.5s)
        elif t < 22.5:
            draw_header(draw, active_nav="upload")
            draw_map_section(draw, t, selected_ocean="PAC")

            proc_t = t - 16.5
            if proc_t < 0:
                draw_upload_panel(draw, state="upload")
                draw_animated_cursor(draw, (1600, 760), click_anim=max(0, 1.0 - (t - 16.0) * 3))
            else:
                pct = min(100, (proc_t / 5.2) * 100)
                if pct < 25:
                    st, sub = "Connecting to Google Gemini Vision AI API...", "Live multimodal reasoning model initializing"
                elif pct < 50:
                    st, sub = "Fetching Live Oceanographic Telemetry API...", "Querying Open-Meteo current vectors & wave heights"
                elif pct < 75:
                    st, sub = "Analyzing Global Bathymetry & Currents...", "Modeling hydrodynamic drift in North Pacific Gyre"
                elif pct < 90:
                    st, sub = "Detecting Synthetic Polymer Signatures...", "Scanning spectral absorption peaks at 1200nm & 1730nm"
                else:
                    st, sub = "Synthesizing Planetary Coordinates...", "Generating geospatial bounds & confidence vectors"

                draw_upload_panel(draw, state="processing", progress=pct, status_text=st, subtext=sub)

        # SCENE 5: AI Analysis Complete & Detection Breakdown (22.5s - 27.5s)
        elif t < 27.5:
            draw_header(draw, active_nav="results")
            draw_map_section(draw, t, selected_ocean="PAC")
            draw_upload_panel(draw, state="complete")

            cur_x = int(1350 + (1450 - 1350) * min(1.0, (t - 23.5) / 1.5))
            cur_y = int(700)
            click_anim = max(0, 1.0 - (t - 25.5) * 3) if 25.5 <= t <= 26.0 else 0
            draw_animated_cursor(draw, (cur_x, cur_y), click_anim)

        # SCENE 6: Outro & API Summary (27.5s - 32.0s)
        else:
            draw_header(draw, active_nav="menu")
            draw_map_section(draw, t, selected_ocean="PAC")
            draw_upload_panel(draw, state="complete")

            draw.rectangle([0, 0, WIDTH, HEIGHT], fill=(0, 0, 0, 150))
            draw.rounded_rectangle([WIDTH//2 - 420, HEIGHT//2 - 200, WIDTH//2 + 420, HEIGHT//2 + 200], radius=16, fill=(10, 20, 38, 250), outline=CYAN_ACCENT, width=2)
            draw.text((WIDTH//2 - 200, HEIGHT//2 - 150), "QORVIA", font=F_TITLE_M, fill=TEXT_WHITE)
            draw.text((WIDTH//2 - 380, HEIGHT//2 - 90), "for the next generation — Live Multimodal APIs Integrated", font=F_BODY_M, fill=CYAN_ACCENT)

            draw.line([WIDTH//2 - 380, HEIGHT//2 - 50, WIDTH//2 + 380, HEIGHT//2 - 50], fill=BORDER_SLATE, width=1)
            draw.text((WIDTH//2 - 360, HEIGHT//2 - 20), "• Google Gemini 1.5/2.0 Vision API (Multimodal AI Detection)", font=F_MONO_S, fill=TEXT_WHITE)
            draw.text((WIDTH//2 - 360, HEIGHT//2 + 20), "• Open-Meteo Marine Telemetry API (Live Currents, Waves, Temp)", font=F_MONO_S, fill=GREEN_ACCENT)
            draw.text((WIDTH//2 - 360, HEIGHT//2 + 60), "• Esri Global High-Resolution Satellite Basemap API", font=F_MONO_S, fill=TEXT_WHITE)
            draw.text((WIDTH//2 - 360, HEIGHT//2 + 100), "• Full Coverage: Pacific, Atlantic, Indian (20 nodes), Arctic, Southern, Med", font=F_MONO_S, fill=YELLOW_ACCENT)
            draw.text((WIDTH//2 - 120, HEIGHT//2 + 155), "Reserved @ 2026", font=F_MONO_XS, fill=TEXT_MUTED)

        frame_np = np.array(base_img.convert("RGB"))
        frame_bgr = cv2.cvtColor(frame_np, cv2.COLOR_RGB2BGR)
        out.write(frame_bgr)

        if frame_idx % (FPS * 5) == 0 or frame_idx == total_frames - 1:
            print(f"Rendered {frame_idx}/{total_frames} frames ({int(frame_idx/total_frames*100)}%)")

    out.release()
    print(f"Qorvia demo video rendered successfully: {output_path}")

if __name__ == "__main__":
    render_demo_video("demo_video.mp4")
