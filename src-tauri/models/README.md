# ONNX Models for Face Recognition

This directory contains ONNX models used for face detection and recognition.

## Required Models

### 1. Face Detection Model
**File:** `scrfd_10g_bnkps.onnx` (~16MB)
**Purpose:** Detect faces in images and return bounding boxes
**Download:** 
```bash
# Option 1: From InsightFace GitHub
curl -L -o scrfd_10g_bnkps.onnx \
  "https://huggingface.co/DIAMONIK7777/scrfd/resolve/main/scrfd_10g_bnkps.onnx"

# Option 2: Alternative source
# Visit https://github.com/deepinsight/insightface/tree/master/model_zoo
```

### 2. Face Recognition Model
**File:** `arcface_w600k_r50.onnx` (~167MB)
**Purpose:** Generate 512-dimensional face embeddings for similarity comparison
**Download:**
```bash
# From InsightFace model zoo
curl -L -o arcface_w600k_r50.onnx \
  "https://huggingface.co/DIAMONIK7777/insightface/resolve/main/w600k_r50.onnx"
```

## Alternative: Using Lightweight Models

If the above models are too large, you can use smaller alternatives:

### Lightweight Face Detection
**File:** `scrfd_500m_bnkps.onnx` (~2.5MB)
**Download:**
```bash
curl -L -o scrfd_500m_bnkps.onnx \
  "https://huggingface.co/DIAMONIK7777/scrfd/resolve/main/scrfd_500m_bnkps.onnx"
```

### Lightweight Face Recognition
**File:** `mobilefacenet.onnx` (~4MB)
**Download:**
```bash
curl -L -o mobilefacenet.onnx \
  "https://huggingface.co/DIAMONIK7777/insightface/resolve/main/mobilefacenet.onnx"
```

## Model Usage in Code

Models are loaded at runtime from this directory. The application will look for:
1. `scrfd_10g_bnkps.onnx` or `scrfd_500m_bnkps.onnx` (detection)
2. `arcface_w600k_r50.onnx` or `mobilefacenet.onnx` (recognition)

## License

These models are from the InsightFace project and are available under their respective licenses. 
Please review the licenses before use in production:
- https://github.com/deepinsight/insightface

## Building the App

If models are not present during build, the app will compile but face recognition features will not work. Users can download models later and restart the app.
