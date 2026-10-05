import os
import time
import cv2
import numpy as np
import onnxruntime as ort
from ultralytics import YOLO
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("chlorine-api")

app = FastAPI(
    title="Chlorine Level Prediction API",
    description="FastAPI deployment for YOLOv8 object/tube detection and Keras CNN model prediction",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CONFIG
ACTIVE_MODEL = "v1"
IMG_SIZE = 64
MODEL_PATHS = {
    "v1": os.path.join("models", "chlorine_model_fixed.onnx")
}

# ---------------------------------------------
# LOAD MODELS
# ---------------------------------------------
models = {}
try:
    for name, path in MODEL_PATHS.items():
        models[name] = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
    logger.info(f"ONNX Model loaded: {list(models.keys())}")
except Exception as e:
    logger.error(f"Error loading ONNX model: {str(e)}")
    raise e

try:
    tube_yolo = YOLO(os.path.join("models", "tube_detector.onnx"), task="detect")
    person_yolo = YOLO("yolov8n.onnx", task="detect")
    logger.info("YOLO ONNX models loaded successfully.")
except Exception as e:
    logger.error(f"Error loading YOLO ONNX models: {str(e)}")
    raise e



# ---------------------------------------------
# UTILITIES
# ---------------------------------------------
def fast_resize(img: np.ndarray, max_dim: int = 640) -> np.ndarray:
    h, w = img.shape[:2]
    if max(h, w) <= max_dim:
        return img
    scale = max_dim / float(max(h, w))
    return cv2.resize(
        img,
        (int(w * scale), int(h * scale)),
        interpolation=cv2.INTER_AREA
    )


def contains_foreign_objects(img: np.ndarray) -> bool:
    logger.debug("Running foreign object check...")
    # Raise conf threshold to 0.45 to ignore faint shadows or small noise
    results = person_yolo(img, imgsz=640, conf=0.45, verbose=False)
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
                    logger.warning(f"Forbidden object detected: {label} (relative area: {relative_area:.1%})")
                    return True
    return False


def is_valid_background(img: np.ndarray) -> bool:
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

    logger.info(f"Background check stats - Mean V: {mean_v:.2f}, Mean S: {mean_s:.2f}, Std: {std_region:.2f}")

    # Relax thresholds to allow crumpled paper (higher std deviation limit of 110)
    # and warm/cool ambient lighting casts (higher mean saturation limit of 85, lower mean brightness limit of 80)
    return (
        mean_v > 80 and
        mean_s < 85 and
        std_region < 110
    )


def get_tube_crop(img: np.ndarray) -> np.ndarray:
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
                        "conf": conf,
                        "area_pct": area_pct
                    })

    if len(candidates) > 0:
        # Sort by area descending to find the largest candidate (main tube)
        candidates.sort(key=lambda x: x["area_pct"], reverse=True)
        best = candidates[0]
        x1, y1, x2, y2 = best["box"]
        pad = 30
        logger.info(f"Tube detected (heuristic best) at: x=[{x1},{x2}], y=[{y1},{y2}], conf={best['conf']:.2f}, area_pct={best['area_pct']:.1f}%")
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
                logger.info(f"Tube detected (fallback) at: x=[{x1},{x2}], y=[{y1},{y2}]")
                return img[
                    max(0, y1 - pad):min(h, y2 + pad),
                    max(0, x1 - pad):min(w, x2 + pad)
                ]
    return None


def prepare_for_cnn(img: np.ndarray) -> np.ndarray:
    img = cv2.resize(img, (64, 64))
    img = img / 255.0
    return np.expand_dims(img, axis=0)


def predict_model(img: np.ndarray) -> np.ndarray:
    session = models[ACTIVE_MODEL]
    input_name = session.get_inputs()[0].name
    ort_outputs = session.run(None, {input_name: img.astype(np.float32)})
    return ort_outputs[0]


# ---------------------------------------------
# PIPELINE
# ---------------------------------------------
def _run_predict(img: np.ndarray):
    total = time.time()
    try:
        t = time.time()
        foreign = contains_foreign_objects(img)
        logger.info(f"[TIME] Foreign Object detection: {(time.time()-t)*1000:.2f} ms")

        if foreign:
            logger.warning("[ERROR] Foreign Object Detected. Terminating pipeline.")
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={"message": "Other object detected"}
            )

        t = time.time()
        crop = get_tube_crop(img)
        logger.info(f"[TIME] Tube Detection: {(time.time()-t)*1000:.2f} ms")

        if crop is None:
            logger.warning("[ERROR] No Tube Detected. Terminating pipeline.")
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={"message": "No tube detected"}
            )

        logger.info(f"[INFO] Tube Crop Shape: {crop.shape}")

        t = time.time()
        bg = is_valid_background(crop)
        logger.info(f"[TIME] Background Check: {(time.time()-t)*1000:.2f} ms")

        if not bg:
            logger.warning("[ERROR] Wrong Background. Terminating pipeline.")
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={"message": "Wrong background"}
            )

        t = time.time()
        cnn = prepare_for_cnn(crop)
        pred = predict_model(cnn)
        cnn_time = (time.time() - t) * 1000

        raw_prediction = float(pred[0][0])
        ppm = round(raw_prediction * 1.4, 2)
        
        # Apply bound clamping to prevent out of bounds PPM prediction
        ppm = max(0.0, ppm)

        logger.info(f"[TIME] CNN Prediction: {cnn_time:.2f} ms")
        logger.info(f"[INFO] Raw Prediction: {raw_prediction:.6f}")
        logger.info(f"[INFO] Predicted PPM: {ppm}")
        logger.info(f"[SUCCESS] Total Processing Time: {(time.time() - total)*1000:.2f} ms")

        return {"ppm": ppm}

    except Exception as e:
        logger.exception(f"[EXCEPTION] Internal pipeline error: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "message": "Internal Server Error",
                "error": str(e)
            }
        )


# ---------------------------------------------
# ROUTES
# ---------------------------------------------
@app.post("/vfive_predict")
def predict(image: UploadFile = File(...)):
    try:
        logger.info(f"[NEW REQUEST] Filename: {image.filename}")
        
        # Read file into byte buffer synchronously
        contents = image.file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            logger.warning("[ERROR] Invalid Image Uploaded")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wrong image"
            )

        logger.info(f"[INFO] Original Shape: {img.shape}")
        img = fast_resize(img)
        logger.info(f"[INFO] Resized Shape: {img.shape}")

        return _run_predict(img)

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.exception(f"[ROUTE ERROR] {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Route Error: {str(e)}"
        )


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "vfive",
        "model": ACTIVE_MODEL,
        "models_loaded": list(models.keys()),
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }


@app.get("/")
async def root():
    return {
        "message": "Chlorine prediction service is running. Send a POST request to /vfive_predict with an image.",
        "health_check": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5100, reload=False)
