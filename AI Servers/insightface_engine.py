import cv2
import uvicorn
import time
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from insightface.app import FaceAnalysis
from pydantic import BaseModel

app = FastAPI()

# UXP localhost calls ko block na kare, isliye CORS allow karna mandatory hai
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 1. LIFECYCLE & WATCHDOG VARIABLES
# ==========================================
LAST_HEARTBEAT = time.time()
TIMEOUT_SECONDS = 6.0  # 6 second tak UXP se ping nahi mila to auto-terminate

print("🚀 Booting Studio AI Engine into Memory...")
face_engine = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
face_engine.prepare(ctx_id=0, det_size=(640, 640))
print("✅ AI Engine Online! Listening for Photoshop UXP on port 8000...")


class Payload(BaseModel):
    image_path: str


# ==========================================
# 2. LIFECYCLE ENDPOINTS (UXP Sync)
# ==========================================
@app.get("/ping")
def ping():
    """Plugin check karega ki server zinda hai ya boot karna padega"""
    return {"status": "ok"}


@app.post("/heartbeat")
def heartbeat():
    """Plugin har 2 second me ping karega taaki server ko pata rahe PS chalu hai"""
    global LAST_HEARTBEAT
    LAST_HEARTBEAT = time.time()
    return {"status": "alive"}


@app.post("/shutdown")
def shutdown():
    """Plugin close hote hi instant memory flush & termination"""
    print("🛑 Explicit shutdown command from Photoshop UXP. Terminating AI Engine...")
    os._exit(0)


# ==========================================
# 3. CORE AI ENDPOINT (Skin Anchor)
# ==========================================
def build_face_entry(face):
    """Helper: build a single face entry dict from an InsightFace face object."""
    box = face.bbox.astype(int)
    x1, y1, x2, y2 = int(box[0]), int(box[1]), int(box[2]), int(box[3])
    width = x2 - x1
    height = y2 - y1

    center_x = int((x1 + x2) / 2)
    center_y = int((y1 + y2) / 2)

    # Skin patch: 60% below center, 40% above (to avoid forehead tilak/ornaments)
    patch_w = int(width * 0.5)
    patch_h = int(height * 0.5)
    patch_x = int(center_x - (patch_w / 2))
    patch_y = int(center_y - (patch_h * 0.4))  # 60% below, 40% above center

    return {
        "anchor": {"x": center_x, "y": center_y},
        "bbox": {
            "x": x1,
            "y": y1,
            "width": width,
            "height": height,
            "corners": {"x1": x1, "y1": y1, "x2": x2, "y2": y2}
        },
        "skin_patch": {
            "x": patch_x,
            "y": patch_y,
            "width": patch_w,
            "height": patch_h
        },
        "confidence": round(float(face.det_score) * 100, 1),
    }


@app.post("/get-skin-anchor")
def get_skin_anchor(data: Payload):
    # ── DEBUG: print image path received ──
    # Normalize Windows path (backslashes → forward)
    image_path = data.image_path.replace("\\", "/")
    print(f"\n📥 RECEIVED path: '{image_path}'")

    # Check if file exists
    if not os.path.exists(data.image_path):
        print(f"❌ File does NOT exist at: {data.image_path}")
        # Try alternate paths
        alt_paths = [
            data.image_path.replace("\\", "/"),
            "/" + data.image_path.replace("\\", "/").replace(":", ""),
        ]
        for ap in alt_paths:
            print(f"   Trying alt: {ap} → exists={os.path.exists(ap)}")
        return {"success": False, "error": f"File not found: {data.image_path}"}

    # 1. Read image from SSD
    img = cv2.imread(image_path)
    if img is None:
        print(f"❌ cv2.imread returned None even though file exists at: {image_path}")
        return {"success": False, "error": "File not found or unreadable path."}
    print(f"✅ Image loaded. Shape: {img.shape} (HxWxC)")

    # 2. Scan faces
    faces = face_engine.get(img)
    print(f"🔍 Model returned {len(faces)} raw face detections")

    if len(faces) == 0:
        print("⚠️ Zero faces returned by model — returning empty success for histogram-based fallback")
        return {"success": True, "face_count": 0, "faces": []}

    # ── DEBUG: Print ALL detected faces with confidence ──
    print("\n" + "=" * 60)
    print(f"📸 Image: {data.image_path}")
    print(f"🔍 Total faces detected: {len(faces)}")
    print("=" * 60)
    sorted_all = sorted(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)
    for i, f in enumerate(sorted_all):
        area = (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])
        conf = round(float(f.det_score) * 100, 1)
        box = f.bbox.astype(int)
        status = "✅ SELECTED" if (f.det_score >= 0.5 and area >= 16000) else "❌ SKIPPED"
        print(f"  Face[{i}] area={area:>8}  conf={conf:>5}%  bbox=({box[0]},{box[1]},{box[2]},{box[3]})  {status}")
    print("=" * 60 + "\n")

    # 3. Filter: keep only faces with confidence >= 0.5 (det_score is 0-1)
    #    AND minimum area >= 16,000 px (chhoti faces / noise ignore)
    MIN_AREA = 16000
    confident_faces = [
        f for f in faces 
        if f.det_score >= 0.5 
        and (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]) >= MIN_AREA
    ]

    print(f"🔍 After area filter (≥{MIN_AREA}px): {len(confident_faces)} faces remain")

    if len(confident_faces) == 0:
        print("⚠️ No face passed confidence + area filter — returning empty success for histogram fallback")
        return {"success": True, "face_count": 0, "faces": []}

    # 4. Sort by confidence descending (highest first), up to 4
    faces_sorted = sorted(
        confident_faces,
        key=lambda f: f.det_score,
        reverse=True
    )
    selected = faces_sorted[:4]

    # 5. Build face entries
    face_entries = [build_face_entry(f) for f in selected]

    return {
        "success": True,
        "face_count": len(face_entries),
        "faces": face_entries,
    }


# ==========================================
# 4. BACKGROUND WATCHDOG MONITOR
# ==========================================
# def watchdog_monitor():
#     while True:
#         time.sleep(1)
#         # Agar crash ya close hone ki wajah se heartbeat aana band ho jaye
#         if time.time() - LAST_HEARTBEAT > TIMEOUT_SECONDS:
#             print("💀 UXP Heartbeat Lost (Photoshop closed/crashed). Auto-killing AI Server...")
#             os._exit(0)


if __name__ == "__main__":
    # # Background daemon thread start karo jo heartbeat monitor karega
    # monitor_thread = threading.Thread(target=watchdog_monitor, daemon=True)
    # monitor_thread.start()

    # # Localhost server chalu karega (Port 8000)
    uvicorn.run(app, host="127.0.0.1", port=8000)
