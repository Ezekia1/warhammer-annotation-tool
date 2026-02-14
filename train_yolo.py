#!/usr/bin/env python3
"""
YOLO Training Script for Warhammer 40K Miniature Detection
Runs on CPU - will take a while but works for small datasets
"""

from ultralytics import YOLO
import os

# Paths
DATA_YAML = "/home/sinan/Active/Projects/photoanalyzer/backend/yolo_dataset/data.yaml"
OUTPUT_DIR = "/home/sinan/Active/Projects/photoanalyzer/runs"

print("=" * 50)
print("Warhammer 40K Miniature Detector Training")
print("=" * 50)
print(f"Dataset: {DATA_YAML}")
print(f"Output: {OUTPUT_DIR}")
print("Device: CPU (no GPU detected)")
print("This will take a while... go grab a coffee!")
print("=" * 50)

# Load pretrained YOLOv8 nano model
model = YOLO('yolov8n.pt')

# Train with CPU-friendly settings
results = model.train(
    data=DATA_YAML,
    epochs=30,           # Reduced for CPU
    imgsz=416,           # Smaller image size for faster training
    batch=8,             # Smaller batch for CPU memory
    patience=10,         # Early stopping
    device='cpu',        # Force CPU
    workers=4,           # Parallel data loading
    save=True,
    project=OUTPUT_DIR,
    name='warhammer_detector',
    exist_ok=True,       # Overwrite if exists
    verbose=True
)

print("\n" + "=" * 50)
print("Training Complete!")
print("=" * 50)
print(f"Best model saved to: {OUTPUT_DIR}/warhammer_detector/weights/best.pt")
print("\nValidating model...")

# Validate
best_model = YOLO(f'{OUTPUT_DIR}/warhammer_detector/weights/best.pt')
metrics = best_model.val(data=DATA_YAML)

print(f"\n=== Final Model Metrics ===")
print(f"mAP50: {metrics.box.map50:.3f}")
print(f"mAP50-95: {metrics.box.map:.3f}")
print(f"Precision: {metrics.box.mp:.3f}")
print(f"Recall: {metrics.box.mr:.3f}")
