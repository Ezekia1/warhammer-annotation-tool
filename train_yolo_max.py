#!/usr/bin/env python3
"""
Maximum YOLO Training - Push the model to its limits
Uses larger model, more epochs, aggressive augmentation
"""

from ultralytics import YOLO
import os

DATA_YAML = "/home/sinan/Active/Projects/photoanalyzer/backend/yolo_dataset/data.yaml"
OUTPUT_DIR = "/home/sinan/Active/Projects/photoanalyzer/runs"

print("=" * 60)
print("MAXIMUM YOLO TRAINING - Pushing limits!")
print("=" * 60)
print("Model: YOLOv8s (small) - 3x more params than nano")
print("Resolution: 640px (vs 416px before)")
print("Epochs: 100 (vs 30 before)")
print("Augmentation: MAXIMUM")
print("=" * 60)
print("This will take a while on CPU... maybe grab dinner!")
print("=" * 60)

# Use YOLOv8 SMALL model (11M params vs 3M for nano)
model = YOLO('yolov8s.pt')

# Train with aggressive settings
results = model.train(
    data=DATA_YAML,

    # Training duration
    epochs=100,              # More epochs
    patience=20,             # More patience before early stopping

    # Resolution
    imgsz=640,               # Higher resolution (was 416)

    # Batch and workers
    batch=4,                 # Smaller batch for CPU memory with larger model
    workers=4,

    # Device
    device='cpu',

    # Augmentation - MAXIMUM
    hsv_h=0.015,             # Hue augmentation
    hsv_s=0.7,               # Saturation augmentation
    hsv_v=0.4,               # Value augmentation
    degrees=15,              # Rotation (+/- 15 degrees)
    translate=0.1,           # Translation
    scale=0.5,               # Scale augmentation
    shear=5,                 # Shear augmentation
    perspective=0.0005,      # Perspective augmentation
    flipud=0.1,              # Vertical flip (some minis are upside down)
    fliplr=0.5,              # Horizontal flip
    mosaic=1.0,              # Mosaic augmentation (combine 4 images)
    mixup=0.15,              # Mixup augmentation (blend images)
    copy_paste=0.1,          # Copy-paste augmentation

    # Learning rate
    lr0=0.01,                # Initial learning rate
    lrf=0.01,                # Final learning rate factor
    warmup_epochs=5,         # Warmup epochs

    # Regularization
    weight_decay=0.0005,
    dropout=0.1,             # Add dropout for regularization

    # Loss weights
    box=7.5,                 # Box loss weight
    cls=0.5,                 # Classification loss weight

    # Output
    save=True,
    save_period=10,          # Save checkpoint every 10 epochs
    project=OUTPUT_DIR,
    name='warhammer_detector_max',
    exist_ok=True,
    verbose=True,
    plots=True,
)

print("\n" + "=" * 60)
print("MAXIMUM Training Complete!")
print("=" * 60)

# Validate
best_model = YOLO(f'{OUTPUT_DIR}/warhammer_detector_max/weights/best.pt')
metrics = best_model.val(data=DATA_YAML)

print(f"\n=== Final Model Metrics ===")
print(f"mAP50: {metrics.box.map50:.3f}")
print(f"mAP50-95: {metrics.box.map:.3f}")
print(f"Precision: {metrics.box.mp:.3f}")
print(f"Recall: {metrics.box.mr:.3f}")

print(f"\nModel saved to: {OUTPUT_DIR}/warhammer_detector_max/weights/best.pt")
