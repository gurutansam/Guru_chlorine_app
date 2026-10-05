import streamlit as st
import onnxruntime as ort
from ultralytics import YOLO
import cv2
import numpy as np
import os
import time
from PIL import Image
import pandas as pd

# Page Configuration
st.set_page_config(
    page_title="Chlorine PPM Detector",
    page_icon="🧪",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styles
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    
    * {
        font-family: 'Plus Jakarta Sans', sans-serif;
    }
    
    .main-title {
        font-family: 'Outfit', sans-serif;
        background: linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 2.8rem;
        font-weight: 800;
        text-align: center;
        margin-bottom: 0.5rem;
    }
    
    .sub-title {
        font-size: 1.1rem;
        color: #7B889B;
        text-align: center;
        margin-bottom: 2.5rem;
    }
    
    .status-card {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 16px;
        padding: 1.5rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
        margin-bottom: 1.5rem;
        backdrop-filter: blur(10px);
    }
    
    .success-card {
        background: linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(39, 174, 96, 0.05) 100%);
        border: 1px solid rgba(46, 204, 113, 0.3);
        border-radius: 16px;
        padding: 2rem;
        text-align: center;
        margin-top: 1rem;
    }
    
    .error-card {
        background: linear-gradient(135deg, rgba(231, 76, 60, 0.15) 0%, rgba(192, 57, 43, 0.05) 100%);
        border: 1px solid rgba(231, 76, 60, 0.3);
        border-radius: 16px;
        padding: 1.5rem;
        text-align: center;
        margin-top: 1rem;
    }
    
    .metric-value {
        font-family: 'Outfit', sans-serif;
        font-size: 4rem;
        font-weight: 800;
        line-height: 1;
        margin-bottom: 0.5rem;
    }
    
    .metric-label {
        font-size: 1rem;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: #A0AEC0;
    }
</style>
""", unsafe_allow_html=True)

# App Title & Subtitle
st.markdown('<div class="main-title">🧪 Chlorine Level Prediction</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">Advanced Computer Vision & CNN-based Chlorine PPM Estimator</div>', unsafe_allow_html=True)

# Config Constants
IMG_SIZE = 64
ACTIVE_MODEL = "v1"

# ---------------------------------------------
# CACHED MODEL LOADER
# ---------------------------------------------
@st.cache_resource(show_spinner="Loading Deep Learning Models... Please hold.")
def load_all_models():
    # Paths
    keras_path = os.path.join("models", "chlorine_model_fixed.onnx")
    tube_yolo_path = os.path.join("models", "tube_detector.onnx")
    person_yolo_path = "yolov8n.onnx"

    # Load ONNX CNN
    cnn_model = ort.InferenceSession(keras_path, providers=['CPUExecutionProvider'])
    
    # Load YOLO models
    tube_yolo = YOLO(tube_yolo_path, task="detect")
    person_yolo = YOLO(person_yolo_path, task="detect")

    return cnn_model, tube_yolo, person_yolo

try:
    cnn_model, tube_yolo, person_yolo = load_all_models()
    st.sidebar.success("✅ All models connected and loaded.")
except Exception as e:
    st.sidebar.error(f"❌ Error loading models: {str(e)}")
    st.stop()

# ---------------------------------------------
# IMAGE PROCESSING FUNCTIONS
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

def run_foreign_object_detection(img):
    # Raise conf threshold to 0.45 to ignore faint shadows or small noise
    results = person_yolo(img, imgsz=640, conf=0.45, verbose=False)
    forbidden = [
        "person", "cell phone", "bottle",
        "cup", "book", "mouse", "handbag", "laptop", "keyboard"
    ]
    detected_items = []
    annotated_img = img.copy()
    h, w = img.shape[:2]
    total_area = h * w
    
    for r in results:
        for box in r.boxes:
            label = person_yolo.names[int(box.cls[0])]
            conf = float(box.conf[0])
            if label in forbidden:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                obj_area = (x2 - x1) * (y2 - y1)
                relative_area = obj_area / total_area
                # Only block/flag if the foreign object occupies > 5% of the total image area
                if relative_area > 0.05:
                    detected_items.append((label, conf))
                    # Draw box
                    cv2.rectangle(annotated_img, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    cv2.putText(annotated_img, f"{label} {conf:.2f} ({relative_area:.1%})", (x1, y1 - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
    return len(detected_items) > 0, detected_items, annotated_img

def run_tube_detection(img):
    results = tube_yolo(img, imgsz=640, conf=0.25, verbose=False)
    h, w = img.shape[:2]
    total_area = h * w
    crop = None
    annotated_img = img.copy()
    box_coords = None

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
        box_coords = (x1, y1, x2, y2)
        crop = img[
            max(0, y1 - pad):min(h, y2 + pad),
            max(0, x1 - pad):min(w, x2 + pad)
        ]
        cv2.rectangle(annotated_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(annotated_img, f"Tube {best['conf']:.2f} ({best['area_pct']:.1f}%)", (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
    else:
        # Fallback to the highest confidence box if no candidates passed filters
        for r in results:
            if r.boxes:
                for box in r.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    pad = 30
                    box_coords = (x1, y1, x2, y2)
                    crop = img[
                        max(0, y1 - pad):min(h, y2 + pad),
                        max(0, x1 - pad):min(w, x2 + pad)
                    ]
                    cv2.rectangle(annotated_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(annotated_img, "Tube (Fallback)", (x1, y1 - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                    break
                break
    return crop, annotated_img, box_coords

def run_background_validation(img):
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
    is_valid = (mean_v > 80 and mean_s < 85 and std_region < 110)
    return is_valid, {"mean_v": mean_v, "mean_s": mean_s, "std_region": std_region}


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
    
    # If the whole crop or center region is extremely uniform, there's no tube
    if whole_std < 15.0 or center_std < 12.0:
        return False
        
    # If the center is almost identical in color/brightness to the borders, there's no tube in the center
    if color_diff < 5.0:
        return False
        
    return True


def prepare_for_cnn(img):
    resized = cv2.resize(img, (64, 64))
    normalized = resized / 255.0
    return np.expand_dims(normalized, axis=0)

# ---------------------------------------------
# APP TABS
# ---------------------------------------------
tab1, tab2 = st.tabs(["📸 Single Image Prediction", "📊 Batch Processing"])

with tab1:
    st.markdown("### Upload Image or Use Web Camera")
    
    # Selection of input method
    input_method = st.radio("Choose Input Source:", ["Upload File", "Use Camera"], horizontal=True)
    
    uploaded_file = None
    if input_method == "Upload File":
        uploaded_file = st.file_uploader("Choose an image file...", type=["jpg", "jpeg", "png"])
    else:
        uploaded_file = st.camera_input("Take a photo of the tube")

    if uploaded_file is not None:
        # Load and convert image
        t_start = time.time()
        
        file_bytes = np.asarray(bytearray(uploaded_file.read()), dtype=np.uint8)
        img_bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        
        if img_bgr is not None:
            # Resize
            t_preprocess_start = time.time()
            img_bgr = fast_resize(img_bgr)
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            t_preprocess = time.time() - t_start
            
            col1, col2 = st.columns(2)
            with col1:
                st.image(img_rgb, caption="Original Image", use_container_width=True)
            
            with col2:
                st.markdown("#### Processing Status")
                progress_bar = st.progress(0)
                
                # 1. Foreign Object Check
                t_foreign_start = time.time()
                progress_bar.progress(25)
                has_foreign, foreign_items, foreign_annotated = run_foreign_object_detection(img_bgr)
                t_foreign = time.time() - t_foreign_start
                
                if has_foreign:
                    t_total = time.time() - t_start
                    st.markdown(
                        f'<div class="error-card">'
                        f'<div class="metric-label" style="color: #ff4b4b;">❌ PROCESS TERMINATED</div>'
                        f'<div style="font-size: 1.1rem; font-weight: 600; margin: 0.5rem 0;">Foreign Object(s) Detected</div>'
                        f'<p style="color: #7B889B;">{", ".join([f"{item[0]} ({item[1]:.2%})" for item in foreign_items])}</p>'
                        f'</div>', 
                        unsafe_allow_html=True
                    )
                    st.image(cv2.cvtColor(foreign_annotated, cv2.COLOR_BGR2RGB), caption="Foreign Objects Bounding Box", use_container_width=True)
                    
                    st.markdown("#### ⏱️ Performance Profile")
                    col_l1, col_l2 = st.columns(2)
                    col_l1.metric("Pre-process", f"{t_preprocess*1000:.1f} ms")
                    col_l2.metric("Foreign Check", f"{t_foreign*1000:.1f} ms")
                    st.error(f"⏱️ **Total Execution Time (Terminated):** **{t_total*1000:.1f} ms**")
                else:
                    st.success(f"✅ Step 1: No foreign objects detected ({t_foreign*1000:.1f} ms).")
                    
                    # 2. Tube Detection
                    t_tube_start = time.time()
                    progress_bar.progress(50)
                    crop_bgr, tube_annotated, box_coords = run_tube_detection(img_bgr)
                    t_tube = time.time() - t_tube_start
                    
                    if crop_bgr is not None:
                        if not is_valid_tube_content(crop_bgr):
                            crop_bgr = None
                            box_coords = None
                    
                    if crop_bgr is None:
                        t_total = time.time() - t_start
                        st.markdown(
                            f'<div class="error-card">'
                            f'<div class="metric-label" style="color: #ff4b4b;">❌ PROCESS TERMINATED</div>'
                            f'<div style="font-size: 1.1rem; font-weight: 600; margin: 0.5rem 0;">No Tube Detected</div>'
                            f'<p style="color: #7B889B;">Ensure the chlorine tube is fully visible in the frame.</p>'
                            f'</div>',
                            unsafe_allow_html=True
                        )
                        st.markdown("#### ⏱️ Performance Profile")
                        col_l1, col_l2, col_l3 = st.columns(3)
                        col_l1.metric("Pre-process", f"{t_preprocess*1000:.1f} ms")
                        col_l2.metric("Foreign Check", f"{t_foreign*1000:.1f} ms")
                        col_l3.metric("Tube Find", f"{t_tube*1000:.1f} ms")
                        st.error(f"⏱️ **Total Execution Time (Terminated):** **{t_total*1000:.1f} ms**")
                    else:
                        st.success(f"✅ Step 2: Tube detected and cropped ({t_tube*1000:.1f} ms).")
                        
                        # 3. Background Check
                        t_bg_start = time.time()
                        progress_bar.progress(75)
                        is_bg_valid, bg_metrics = run_background_validation(crop_bgr)
                        t_bg = time.time() - t_bg_start
                        
                        # Display background metrics
                        with st.expander("Show Background Validation Metrics"):
                            st.write(f"Mean Value (V): **{bg_metrics['mean_v']:.2f}** (Target: > 100)")
                            st.write(f"Mean Saturation (S): **{bg_metrics['mean_s']:.2f}** (Target: < 70)")
                            st.write(f"Standard Deviation: **{bg_metrics['std_region']:.2f}** (Target: < 65)")
                        
                        if not is_bg_valid:
                            t_total = time.time() - t_start
                            st.markdown(
                                f'<div class="error-card">'
                                f'<div class="metric-label" style="color: #ff4b4b;">❌ PROCESS TERMINATED</div>'
                                f'<div style="font-size: 1.1rem; font-weight: 600; margin: 0.5rem 0;">Wrong Background / Lighting</div>'
                                f'<p style="color: #7B889B;">Background did not match criteria. Check your lighting or color profile.</p>'
                                f'</div>',
                                unsafe_allow_html=True
                            )
                            st.markdown("#### ⏱️ Performance Profile")
                            col_l1, col_l2, col_l3, col_l4 = st.columns(4)
                            col_l1.metric("Pre-process", f"{t_preprocess*1000:.1f} ms")
                            col_l2.metric("Foreign Check", f"{t_foreign*1000:.1f} ms")
                            col_l3.metric("Tube Find", f"{t_tube*1000:.1f} ms")
                            col_l4.metric("BG Validate", f"{t_bg*1000:.1f} ms")
                            st.error(f"⏱️ **Total Execution Time (Terminated):** **{t_total*1000:.1f} ms**")
                        else:
                            st.success(f"✅ Step 3: Background verified successfully ({t_bg*1000:.1f} ms).")
                            
                            # 4. Predict
                            t_predict_start = time.time()
                            progress_bar.progress(100)
                            cnn_input = prepare_for_cnn(crop_bgr)
                            input_name = cnn_model.get_inputs()[0].name
                            pred = cnn_model.run(None, {input_name: cnn_input.astype(np.float32)})
                            raw_prediction = float(pred[0][0][0])
                            ppm = round(raw_prediction * 1.4, 2)
                            t_predict = time.time() - t_predict_start
                            
                            t_total = time.time() - t_start
                            
                            # Define colors based on PPM range
                            if ppm < 1.0:
                                border_color = "#3498db" # Low - Blue
                                status_text = "LOW CHLORINE"
                            elif ppm <= 3.0:
                                border_color = "#2ecc71" # Optimal - Green
                                status_text = "OPTIMAL CHLORINE"
                            else:
                                border_color = "#e74c3c" # High - Red
                                status_text = "HIGH CHLORINE"
                                
                            st.markdown(
                                f'<div class="success-card" style="border: 2px solid {border_color};">'
                                f'<div class="metric-value" style="color: {border_color};">{ppm} <span style="font-size: 1.5rem;">PPM</span></div>'
                                f'<div class="metric-label" style="color: {border_color}; font-weight: 700; letter-spacing: 3px;">{status_text}</div>'
                                f'<div style="color: #7B889B; font-size: 0.85rem; margin-top: 1rem;">Raw CNN Output: {raw_prediction:.6f}</div>'
                                f'</div>',
                                unsafe_allow_html=True
                            )
                            
                            # Display images
                            col_c1, col_c2 = st.columns(2)
                            with col_c1:
                                st.image(cv2.cvtColor(tube_annotated, cv2.COLOR_BGR2RGB), caption="Tube Bounding Box", use_container_width=True)
                            with col_c2:
                                st.image(cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB), caption="Cropped Tube Region", use_container_width=True)
                            
                            # Display logs
                            st.markdown("#### ⏱️ Performance Profile")
                            col_l1, col_l2, col_l3, col_l4, col_l5 = st.columns(5)
                            col_l1.metric("Pre-process", f"{t_preprocess*1000:.1f} ms")
                            col_l2.metric("Foreign Check", f"{t_foreign*1000:.1f} ms")
                            col_l3.metric("Tube Find", f"{t_tube*1000:.1f} ms")
                            col_l4.metric("BG Validate", f"{t_bg*1000:.1f} ms")
                            col_l5.metric("CNN Pred", f"{t_predict*1000:.1f} ms")
                            
                            st.info(f"⏱️ **Total Pipeline Execution Time:** **{t_total*1000:.1f} ms** ({t_total:.4f} seconds)")
        else:
            st.error("Error decoding image. Please upload a valid image file.")

with tab2:
    st.markdown("### Batch Processing")
    st.write("Upload multiple images to run predictions on all of them in a batch. You can download the results as a CSV file.")
    
    batch_files = st.file_uploader("Select multiple image files...", type=["jpg", "jpeg", "png"], accept_multiple_files=True)
    
    if batch_files:
        results_list = []
        
        # Table placeholders
        progress_bar_batch = st.progress(0)
        status_text_batch = st.empty()
        
        for i, file in enumerate(batch_files):
            # Update progress
            progress = (i + 1) / len(batch_files)
            progress_bar_batch.progress(progress)
            status_text_batch.text(f"Processing image {i+1} of {len(batch_files)}: {file.name}")
            
            # Start timer
            t_start = time.time()
            
            # Load
            file_bytes = np.asarray(bytearray(file.read()), dtype=np.uint8)
            img_bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            
            if img_bgr is not None:
                # Resize / Preprocess
                img_bgr = fast_resize(img_bgr)
                t_preprocess = time.time() - t_start
                
                # 1. Foreign Object Check
                t_foreign_start = time.time()
                has_foreign, foreign_items, _ = run_foreign_object_detection(img_bgr)
                t_foreign = time.time() - t_foreign_start
                
                if has_foreign:
                    results_list.append({
                        "Filename": file.name,
                        "Status": "Failed (Foreign Object)",
                        "PPM": np.nan,
                        "Preprocess (s)": round(t_preprocess, 4),
                        "Foreign Check (s)": round(t_foreign, 4),
                        "Tube Find (s)": 0.0,
                        "BG Check (s)": 0.0,
                        "CNN Pred (s)": 0.0,
                        "Total Time (s)": round(time.time() - t_start, 4),
                        "Details": ", ".join([f"{x[0]} ({x[1]:.2%})" for x in foreign_items])
                    })
                    continue
                
                # 2. Tube Detection
                t_tube_start = time.time()
                crop_bgr, _, _ = run_tube_detection(img_bgr)
                t_tube = time.time() - t_tube_start
                
                if crop_bgr is not None:
                    if not is_valid_tube_content(crop_bgr):
                        crop_bgr = None
                
                if crop_bgr is None:
                    results_list.append({
                        "Filename": file.name,
                        "Status": "Failed (No Tube)",
                        "PPM": np.nan,
                        "Preprocess (s)": round(t_preprocess, 4),
                        "Foreign Check (s)": round(t_foreign, 4),
                        "Tube Find (s)": round(t_tube, 4),
                        "BG Check (s)": 0.0,
                        "CNN Pred (s)": 0.0,
                        "Total Time (s)": round(time.time() - t_start, 4),
                        "Details": "Could not locate tube"
                    })
                    continue
                
                # 3. Background Validation
                t_bg_start = time.time()
                is_bg_valid, bg_metrics = run_background_validation(crop_bgr)
                t_bg = time.time() - t_bg_start
                
                if not is_bg_valid:
                    results_list.append({
                        "Filename": file.name,
                        "Status": "Failed (Invalid Background)",
                        "PPM": np.nan,
                        "Preprocess (s)": round(t_preprocess, 4),
                        "Foreign Check (s)": round(t_foreign, 4),
                        "Tube Find (s)": round(t_tube, 4),
                        "BG Check (s)": round(t_bg, 4),
                        "CNN Pred (s)": 0.0,
                        "Total Time (s)": round(time.time() - t_start, 4),
                        "Details": f"V: {bg_metrics['mean_v']:.1f}, S: {bg_metrics['mean_s']:.1f}, Std: {bg_metrics['std_region']:.1f}"
                    })
                    continue
                
                # 4. Predict PPM
                t_predict_start = time.time()
                cnn_input = prepare_for_cnn(crop_bgr)
                input_name = cnn_model.get_inputs()[0].name
                pred = cnn_model.run(None, {input_name: cnn_input.astype(np.float32)})
                raw_prediction = float(pred[0][0][0])
                ppm = round(raw_prediction * 1.4, 2)
                t_predict = time.time() - t_predict_start
                
                results_list.append({
                    "Filename": file.name,
                    "Status": "Success",
                    "PPM": ppm,
                    "Preprocess (s)": round(t_preprocess, 4),
                    "Foreign Check (s)": round(t_foreign, 4),
                    "Tube Find (s)": round(t_tube, 4),
                    "BG Check (s)": round(t_bg, 4),
                    "CNN Pred (s)": round(t_predict, 4),
                    "Total Time (s)": round(time.time() - t_start, 4),
                    "Details": f"Raw Output: {raw_prediction:.4f}"
                })
            else:
                results_list.append({
                    "Filename": file.name,
                    "Status": "Failed (Invalid Image File)",
                    "PPM": np.nan,
                    "Preprocess (s)": 0.0,
                    "Foreign Check (s)": 0.0,
                    "Tube Find (s)": 0.0,
                    "BG Check (s)": 0.0,
                    "CNN Pred (s)": 0.0,
                    "Total Time (s)": 0.0,
                    "Details": "Image decoding error"
                })
        
        status_text_batch.text("Processing complete!")
        
        # Display DataFrame
        df = pd.DataFrame(results_list)
        st.dataframe(df, use_container_width=True)
        
        # CSV Download Button
        csv_data = df.to_csv(index=False).encode('utf-8')
        st.download_button(
            label="📥 Download Results as CSV",
            data=csv_data,
            file_name="chlorine_prediction_results.csv",
            mime="text/csv"
        )

# ---------------------------------------------
# SIDEBAR INFO
# ---------------------------------------------
st.sidebar.markdown("---")
st.sidebar.markdown("### System Specs & Configuration")
st.sidebar.info(
    f"**Active Model:** {ACTIVE_MODEL}\n\n"
    f"**Input Dimension:** {IMG_SIZE}x{IMG_SIZE}\n\n"
    f"**Backend Runtime:** TensorFlow + PyTorch (YOLOv8)"
)
st.sidebar.markdown("---")
st.sidebar.markdown(
    "<div style='text-align: center; color: #7B889B; font-size: 0.8rem;'>"
    "Chlorine Level Prediction Tool v1.0.0<br>Deep Learning Pipeline"
    "</div>",
    unsafe_allow_html=True
)
