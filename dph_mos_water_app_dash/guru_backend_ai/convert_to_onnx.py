import os
import sys

# Try to import dependencies and guide the user if they are missing
try:
    import tensorflow as tf
    import tf2onnx
    import onnx
except ImportError:
    print("\n[ERROR] Missing dependencies for Keras conversion.")
    print("Please install them using: pip install tf2onnx onnx\n")
    sys.exit(1)

try:
    from ultralytics import YOLO
except ImportError:
    print("\n[ERROR] Missing dependencies for YOLO conversion.")
    print("Please install them using: pip install ultralytics\n")
    sys.exit(1)

# CONFIG
IMG_SIZE = 64

# Custom Keras Layers (needed to load the model)
def reshape_lambda(t):
    return tf.reshape(t, [-1, IMG_SIZE * IMG_SIZE, 3])

class ColorStdLayer(tf.keras.layers.Layer):
    def __init__(self, img_size=None, **kwargs):
        super(ColorStdLayer, self).__init__(**kwargs)
        self.img_size = img_size
    def call(self, inputs):
        return tf.math.reduce_std(inputs, axis=[1, 2])
    def get_config(self):
        config = super().get_config()
        config.update({"img_size": self.img_size})
        return config

class ClipLayer(tf.keras.layers.Layer):
    def __init__(self, min_val=0.0, max_val=1.0, **kwargs):
        super(ClipLayer, self).__init__(**kwargs)
        self.min_val = min_val
        self.max_val = max_val
    def call(self, inputs):
        return tf.clip_by_value(inputs, self.min_val, self.max_val)
    def get_config(self):
        config = super().get_config()
        config.update({"min_val": self.min_val, "max_val": self.max_val})
        return config


def convert_yolo_model(model_name, model_path):
    print(f"\n--- Converting YOLO Model: {model_name} ---")
    if not os.path.exists(model_path):
        print(f"[SKIP] Model file not found at: {model_path}")
        return
    try:
        model = YOLO(model_path)
        # Export model to ONNX format (imgsz 640 is used by your pipeline)
        onnx_path = model.export(format="onnx", imgsz=640, verbose=False)
        print(f"[SUCCESS] Exported {model_name} to ONNX: {onnx_path}")
    except Exception as e:
        print(f"[ERROR] Failed to convert {model_name}: {str(e)}")


def convert_keras_model():
    print("\n--- Converting Keras CNN Model ---")
    keras_path = os.path.join("models", "chlorine_model_fixed.h5")
    onnx_path = os.path.join("models", "chlorine_model_fixed.onnx")

    if not os.path.exists(keras_path):
        print(f"[SKIP] Keras model file not found at: {keras_path}")
        return

    try:
        # Load Keras model with custom objects
        model = tf.keras.models.load_model(
            keras_path,
            custom_objects={
                "<lambda>": reshape_lambda,
                "ColorStdLayer": ColorStdLayer,
                "ClipLayer": ClipLayer
            },
            compile=False,
            safe_mode=False
        )
        
        # Define input signature (1 batch, 64x64 resolution, 3 channels)
        spec = (tf.TensorSpec((None, 64, 64, 3), tf.float32, name="input"),)
        
        # Convert Keras to ONNX
        model_proto, _ = tf2onnx.convert.from_keras(
            model,
            input_signature=spec,
            opset=13,
            output_path=onnx_path
        )
        print(f"[SUCCESS] Exported Keras model to ONNX: {onnx_path}")
    except Exception as e:
        print(f"[ERROR] Failed to convert Keras model: {str(e)}")


if __name__ == "__main__":
    os.makedirs("models", exist_ok=True)
    
    # 1. Convert YOLOv8 models
    convert_yolo_model("Tube Detector", os.path.join("models", "tube_detector.pt"))
    convert_yolo_model("Foreign Object Screen (nano)", "yolov8n.pt")
    
    # 2. Convert Keras model
    convert_keras_model()
    
    print("\nAll conversions complete! Check the 'models/' and root directories.")
