from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import cv2
import os
import time
import onnxruntime as ort
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# CONFIG
DEBUG_MODE = True
DEBUG_DIR = "debug_outputs"
os.makedirs(DEBUG_DIR, exist_ok=True)

ACTIVE_MODEL = "v1"
IMG_SIZE = 64

MODEL_PATHS = {
    "v1": os.path.join("models", "chlorine_model_fixed.onnx")
}

# ---------------------------------------------
# LOAD MODEL
# ---------------------------------------------
models = {}
for name, path in MODEL_PATHS.items():
    models[name] = ort.InferenceSession(path, providers=['CPUExecutionProvider'])

print("[INFO] ONNX Model loaded:", list(models.keys()))

# ---------------------------------------------
# YOLO MODELS
# ---------------------------------------------
tube_yolo = YOLO(os.path.join("models", "tube_detector.onnx"), task="detect")
person_yolo = YOLO("yolov8n.onnx", task="detect")

# ---------------------------------------------
# UTILITIES
# ---------------------------------------------
def fast_resize(img, max_dim=640):
    h, w = img.shape[:2]

    if max(h, w) <= max_dim:
        return img

    scale = max_dim / float(max(h, w))

    return cv2.resize(
        img,
        (int(w * scale), int(h * scale)),
        interpolation=cv2.INTER_AREA
    )


def contains_foreign_objects(img):
    print("[DEBUG] Before person_yolo")
    # Raise conf threshold to 0.45 to ignore faint shadows or small noise
    results = person_yolo(img, imgsz=640, conf=0.45, verbose=False)
    print("[DEBUG] After person_yolo")
    forbidden = [
        "person", "cell phone", "bottle",
        "cup", "book", "mouse", "handbag", "laptop", "keyboard"
    ]
    h, w = img.shape[:2]
    total_area = h * w

    for r in results:
        for box in r.boxes:
            label = person_yolo.names[int(box.cls[0])]
            if label in forbidden:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                obj_area = (x2 - x1) * (y2 - y1)
                relative_area = obj_area / total_area
                # Only block if the foreign object occupies > 5% of the total image area
                if relative_area > 0.05:
                    return True
    return False


def is_valid_background(img):
    h, w = img.shape[:2]
    border = 0.08

    left = img[:, :int(w * border)]
    right = img[:, int(w * (1 - border)):]

    region = np.concatenate([left.reshape(-1, 3), right.reshape(-1, 3)], axis=0)
    hsv = cv2.cvtColor(
        region.reshape(-1, 1, 3).astype(np.uint8),
        cv2.COLOR_BGR2HSV
    ).reshape(-1, 3)

    mean_v = np.mean(hsv[:, 2])
    mean_s = np.mean(hsv[:, 1])
    std_region = np.std(region)

    # Relax thresholds to allow crumpled paper (higher std deviation limit of 110)
    # and warm/cool ambient lighting casts (higher mean saturation limit of 85, lower mean brightness limit of 80)
    return (
        mean_v > 80 and
        mean_s < 85 and
        std_region < 110
    )


def is_valid_tube_content(crop):
    if crop is None:
        return False
    h, w = crop.shape[:2]
    if h == 0 or w == 0:
        return False
    
    # Extract the border region (left 15% and right 15%)
    border_w = int(w * 0.15)
    left_border = crop[:, :border_w]
    right_border = crop[:, int(w - border_w):]
    borders = np.concatenate([left_border, right_border], axis=1)
    
    # Extract the center region (middle 50% width, and middle 80% height to avoid padding)
    center_w_start = int(w * 0.25)
    center_w_end = int(w * 0.75)
    center_h_start = int(h * 0.1)
    center_h_end = int(h * 0.9)
    center_region = crop[center_h_start:center_h_end, center_w_start:center_w_end]
    
    if center_region.size == 0 or borders.size == 0:
        return False

    # Calculate the mean intensity/color of borders and center
    borders_mean = np.mean(borders, axis=(0, 1))
    center_mean = np.mean(center_region, axis=(0, 1))
    
    # Calculate the absolute difference between center and borders
    color_diff = np.mean(np.abs(borders_mean - center_mean))
    
    # Also calculate the standard deviation of the center region
    center_std = np.std(center_region)
    whole_std = np.std(crop)
    
    print(f"[DEBUG] Tube content validation: color_diff={color_diff:.2f}, center_std={center_std:.2f}, whole_std={whole_std:.2f}")
    
    # If the whole crop or center region is extremely uniform, there's no tube
    if whole_std < 15.0 or center_std < 12.0:
        print("[DEBUG] Rejected: Crop is too uniform (no high-contrast tube structure found)")
        return False
        
    # If the center is almost identical in color/brightness to the borders, there's no tube in the center
    if color_diff < 5.0:
        print("[DEBUG] Rejected: Center is too similar to borders (no tube structure in center)")
        return False
        
    return True


def get_tube_crop(img):
    results = tube_yolo(img, imgsz=640, conf=0.25, verbose=False)
    h, w = img.shape[:2]
    total_area = h * w

    candidates = []
    for r in results:
        if r.boxes:
            for box in r.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                conf = float(box.conf[0])
                box_w = x2 - x1
                box_h = y2 - y1
                area_pct = (box_w * box_h) / total_area * 100
                aspect_ratio = box_h / box_w if box_w > 0 else 0

                # Filter out very small edge boxes and horizontal detections
                if area_pct >= 1.5 and aspect_ratio >= 1.3:
                    candidates.append({
                        "box": (x1, y1, x2, y2),
                        "area_pct": area_pct
                    })

    if len(candidates) > 0:
        # Sort by area descending to find the largest candidate (main tube)
        candidates.sort(key=lambda x: x["area_pct"], reverse=True)
        x1, y1, x2, y2 = candidates[0]["box"]
        pad = 30
        return img[
            max(0, y1 - pad):min(h, y2 + pad),
            max(0, x1 - pad):min(w, x2 + pad)
        ]

    # Fallback to original logic if no candidates passed filters
    for r in results:
        if r.boxes:
            for box in r.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                pad = 30
                return img[
                    max(0, y1 - pad):min(h, y2 + pad),
                    max(0, x1 - pad):min(w, x2 + pad)
                ]
    return None


def prepare_for_cnn(img):
    img = cv2.resize(img, (64, 64))
    img = img / 255.0
    return np.expand_dims(img, axis=0)


def predict_model(img):
    session = models[ACTIVE_MODEL]
    input_name = session.get_inputs()[0].name
    ort_outputs = session.run(None, {input_name: img.astype(np.float32)})
    return ort_outputs[0]


# ---------------------------------------------
# PIPELINE
# ---------------------------------------------
def _run_predict(img):

    total = time.time()

    try:
        t = time.time()
        foreign = contains_foreign_objects(img)
        print(f"[TIME] Foreign Object : {(time.time()-t)*1000:.2f} ms")

        if foreign:
            print("[ERROR] Foreign Object Detected")
            print("=" * 60)
            return jsonify({"success": False, "message": "Other object detected", "error": "Other object detected"}), 200

        t = time.time()
        crop = get_tube_crop(img)
        print(f"[TIME] Tube Detection : {(time.time()-t)*1000:.2f} ms")

        if crop is not None:
            if not is_valid_tube_content(crop):
                crop = None

        if crop is None:
            print("[ERROR] No Tube Detected")
            print("=" * 60)
            return jsonify({"success": False, "message": "No tube detected", "error": "No tube detected"}), 200

        print(f"[INFO] Tube Crop Shape : {crop.shape}")

        t = time.time()
        bg = is_valid_background(crop)
        print(f"[TIME] Background Check : {(time.time()-t)*1000:.2f} ms")

        if not bg:
            print("[ERROR] Wrong Background")
            print("=" * 60)
            return jsonify({"success": False, "message": "Wrong background", "error": "Wrong background"}), 200

        t = time.time()

        cnn = prepare_for_cnn(crop)
        pred = predict_model(cnn)

        cnn_time = (time.time() - t) * 1000

        raw_prediction = float(pred[0][0])
        ppm = round(raw_prediction * 1.4, 2)

        print(f"[TIME] CNN Prediction : {cnn_time:.2f} ms")
        print(f"[INFO] Raw Prediction : {raw_prediction:.6f}")
        print(f"[INFO] Predicted PPM : {ppm}")

        total_time = (time.time() - total) * 1000

        print(f"[SUCCESS] Total Processing Time : {total_time:.2f} ms")
        print("=" * 60)

        return jsonify({
            "success": True,
            "ppm": ppm
        }), 200

    except Exception as e:
        print("[EXCEPTION]", str(e))
        import traceback
        traceback.print_exc()
        print("=" * 60)

        return jsonify({
            "success": False,
            "message": "Internal Server Error",
            "error": str(e)
        }), 200
# ---------------------------------------------
# ROUTE
# ---------------------------------------------
@app.route("/vfive_predict", methods=["POST"])
def predict():

    try:
        print("\n")
        print("=" * 60)
        print("[NEW REQUEST]")

        if "image" not in request.files:
            print("[ERROR] No image uploaded")
            print("=" * 60)
            return jsonify({"success": False, "message": "No image", "error": "No image"}), 200

        file = request.files["image"]

        print(f"[INFO] Filename : {file.filename}")

        img = cv2.imdecode(
            np.frombuffer(file.read(), np.uint8),
            cv2.IMREAD_COLOR
        )

        if img is None:
            print("[ERROR] Invalid Image")
            print("=" * 60)
            return jsonify({"success": False, "message": "Wrong image", "error": "Wrong image"}), 200

        print(f"[INFO] Original Shape : {img.shape}")

        img = fast_resize(img)

        print(f"[INFO] Resized Shape : {img.shape}")

        return _run_predict(img)

    except Exception as e:
        print("[ROUTE ERROR]", str(e))
        import traceback
        traceback.print_exc()

        return jsonify({
            "success": False,
            "message": "Route Error",
            "error": str(e)
        }), 200

# ---------------------------------------------
# HEALTH CHECK
# ---------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "vfive",
        "model": ACTIVE_MODEL,
        "models_loaded": list(models.keys()),
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }), 200


# ---------------------------------------------
# RUN
# ---------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5100)