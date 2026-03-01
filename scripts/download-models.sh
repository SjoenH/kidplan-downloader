#!/bin/bash

# Script to download ONNX models for face recognition
# Models are from HuggingFace mirrors (more reliable than GitHub releases)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="$SCRIPT_DIR/../src-tauri/models"
mkdir -p "$MODELS_DIR"

cd "$MODELS_DIR"

echo "📥 Downloading face detection model (SCRFD)..."
# SCRFD 500M model - lightweight and fast face detection
# Using onnxruntime model zoo
if [ ! -f "version-RFB-320.onnx" ]; then
	curl -L -o "version-RFB-320.onnx" \
		"https://github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB/raw/master/models/onnx/version-RFB-320.onnx" &&
		echo "✅ Face detection model downloaded successfully!" ||
		echo "❌ Warning: Failed to download face detection model. See models/README.md for manual download instructions."
else
	echo "ℹ️  Face detection model already exists, skipping..."
fi

echo ""
echo "📥 Downloading face recognition model (ArcFace)..."
# Using a smaller, readily available face recognition model
# For now, we'll create the infrastructure and users can add their own models
if [ ! -f "arcface.onnx" ]; then
	echo "ℹ️  Face recognition model needs to be downloaded separately."
	echo "ℹ️  Please see models/README.md for download instructions."
	echo "ℹ️  The app will work without it (detection only mode)."
else
	echo "ℹ️  Face recognition model already exists, skipping..."
fi

echo ""
echo "📥 Downloading face recognition model (MobileFaceNet)..."
# MobileFaceNet - lightweight face recognition embeddings
# Much smaller than ArcFace but still effective
if [ ! -f "mobilefacenet.onnx" ]; then
	curl -L -o "mobilefacenet.onnx" \
		"https://huggingface.co/DIAMONIK7777/insightface/resolve/main/mobilefacenet.onnx" &&
		echo "✅ MobileFaceNet model downloaded successfully!" ||
		echo "❌ Warning: Failed to download MobileFaceNet model. See models/README.md for manual download instructions."
else
	echo "ℹ️  MobileFaceNet model already exists, skipping..."
fi

echo ""
echo "📊 Models in directory:"
ls -lh *.onnx 2>/dev/null || echo "No ONNX models found. Please download them manually."
echo ""
echo "✨ Setup complete! You can now build the app with face recognition support."
