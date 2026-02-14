#!/usr/bin/env python3
"""
YOLO11x Training - The latest and most powerful YOLO model
57M parameters, state-of-the-art accuracy
"""

from ultralytics import YOLO
import os

DATA_YAML = "/home/sinan/Active/Projects/photoanalyzer/backend/yolo_dataset/data.yaml"
OUTPUT_DIR = "/home/sinan/Active/Projects/photoanalyzer/runs"

print("=" * 60)
print("YOLO11x - THE BEST MODEL AVAILABLE")
print("=" * 60)
print("Model: YOLO11x (57M params) - State of the art")
print("Resolution: 640px")
print("Epochs: 100")
print("=" * 60)
print("WARNING: This is VERY slow on CPU!")
print("Each epoch may take 10-15 minutes")
print("=" * 60)

# YOLO11x - the latest and best
model = YOLO('yolo11x.pt')

# Train
results = model.train(
    data=DATA_YAML,

    # Training duration
    epochs=100,
    patience=20,

    # Resolution
    imgsz=640,

    # Small batch for memory
    batch=2,  # Very small for large model on CPU
    workers=4,

    # Device
    device='cpu',

    # Augmentation
    degrees=15,
    translate=0.1,
    scale=0.5,
    shear=5,
    flipud=0.1,
    fliplr=0.5,
    mosaic=1.0,
    mixup=0.15,
    copy_paste=0.1,

    # Regularization
    dropout=0.1,

    # Output
    save=True,
    save_period=5,
    project=OUTPUT_DIR,
    name='warhammer_yolo11x',
    exist_ok=True,
    verbose=True,
    plots=True,
)

print("\n" + "=" * 60)
print("YOLO11x Training Complete!")
print("=" * 60)

# Validate
best_model = YOLO(f'{OUTPUT_DIR}/warhammer_yolo11x/weights/best.pt')
metrics = best_model.val(data=DATA_YAML)

print(f"\n=== Final Model Metrics ===")
print(f"mAP50: {metrics.box.map50:.3f}")
print(f"mAP50-95: {metrics.box.map:.3f}")
print(f"Precision: {metrics.box.mp:.3f}")
print(f"Recall: {metrics.box.mr:.3f}")
