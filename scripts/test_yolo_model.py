#!/usr/bin/env python3
"""
YOLO Model Testing Harness

Tests a trained YOLOv8-pose model on validation images and generates:
- Visual predictions with bboxes and keypoints
- Accuracy metrics (mAP, precision, recall)
- Confusion matrix
- Sample prediction gallery

Usage:
    python test_yolo_model.py --model runs/pose/miniature_detector/weights/best.pt
    python test_yolo_model.py --model best.pt --dataset backend/yolo_dataset --save-dir test_results/
"""

import argparse
import sys
from pathlib import Path
import json
from datetime import datetime


class Colors:
    """ANSI color codes"""
    HEADER = '\033[95m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def print_header(msg):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{msg}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 60}{Colors.ENDC}\n")


def print_success(msg):
    print(f"{Colors.OKGREEN}✓ {msg}{Colors.ENDC}")


def print_error(msg):
    print(f"{Colors.FAIL}✗ {msg}{Colors.ENDC}")


def print_warning(msg):
    print(f"{Colors.WARNING}⚠ {msg}{Colors.ENDC}")


def load_model(model_path):
    """Load trained YOLO model"""
    print_header("Loading Model")

    try:
        from ultralytics import YOLO
    except ImportError:
        print_error("ultralytics not installed")
        print("  Run: pip install ultralytics")
        sys.exit(1)

    model_path = Path(model_path)
    if not model_path.exists():
        print_error(f"Model not found: {model_path}")
        sys.exit(1)

    print(f"  Loading model from: {model_path}")
    model = YOLO(str(model_path))
    print_success(f"Model loaded: {model_path.name}")

    return model


def run_validation(model, dataset_path):
    """Run validation and get metrics"""
    print_header("Running Validation")

    dataset_path = Path(dataset_path)
    data_yaml = dataset_path / 'data.yaml'

    if not data_yaml.exists():
        print_error(f"data.yaml not found at {data_yaml}")
        sys.exit(1)

    print(f"  Dataset: {data_yaml}")
    print(f"  Running validation...")

    try:
        results = model.val(data=str(data_yaml), split='val')

        # Extract metrics
        metrics = {
            'mAP50': float(results.box.map50) if hasattr(results.box, 'map50') else 0.0,
            'mAP50-95': float(results.box.map) if hasattr(results.box, 'map') else 0.0,
            'precision': float(results.box.mp) if hasattr(results.box, 'mp') else 0.0,
            'recall': float(results.box.mr) if hasattr(results.box, 'mr') else 0.0,
        }

        # Keypoint metrics if available
        if hasattr(results, 'pose'):
            metrics['kpt_mAP50'] = float(results.pose.map50) if hasattr(results.pose, 'map50') else 0.0
            metrics['kpt_mAP50-95'] = float(results.pose.map) if hasattr(results.pose, 'map') else 0.0

        print_success("Validation complete")
        print(f"\n  Metrics:")
        print(f"    Box mAP@0.5:       {metrics['mAP50']:.3f}")
        print(f"    Box mAP@0.5:0.95:  {metrics['mAP50-95']:.3f}")
        print(f"    Precision:         {metrics['precision']:.3f}")
        print(f"    Recall:            {metrics['recall']:.3f}")

        if 'kpt_mAP50' in metrics:
            print(f"    Keypoint mAP@0.5:  {metrics['kpt_mAP50']:.3f}")

        return metrics

    except Exception as e:
        print_error(f"Validation failed: {e}")
        import traceback
        traceback.print_exc()
        return None


def create_prediction_gallery(model, dataset_path, save_dir, num_samples=20):
    """Create visual gallery of predictions"""
    print_header("Creating Prediction Gallery")

    import cv2
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont

    dataset_path = Path(dataset_path)
    save_dir = Path(save_dir)
    save_dir.mkdir(parents=True, exist_ok=True)

    # Get validation images
    val_images_dir = dataset_path / 'images' / 'val'
    if not val_images_dir.exists():
        print_warning("Validation images directory not found")
        return

    image_files = list(val_images_dir.glob('*.jpg')) + list(val_images_dir.glob('*.png'))
    if not image_files:
        print_warning("No validation images found")
        return

    # Sample random images
    import random
    random.shuffle(image_files)
    sample_files = image_files[:min(num_samples, len(image_files))]

    print(f"  Generating predictions for {len(sample_files)} images...")

    gallery_dir = save_dir / 'predictions'
    gallery_dir.mkdir(exist_ok=True)

    for idx, img_path in enumerate(sample_files, 1):
        print(f"  [{idx}/{len(sample_files)}] {img_path.name}")

        # Run prediction
        results = model.predict(
            source=str(img_path),
            conf=0.25,
            save=False,
            verbose=False
        )

        if not results or len(results) == 0:
            continue

        result = results[0]

        # Save annotated image
        output_path = gallery_dir / f'pred_{idx:03d}_{img_path.name}'

        # Use YOLO's built-in plotting
        annotated = result.plot()  # Returns BGR numpy array
        cv2.imwrite(str(output_path), annotated)

    print_success(f"Gallery created: {gallery_dir}")
    print(f"  {len(sample_files)} annotated images saved")


def test_on_image(model, image_path, save_path=None):
    """Test model on a single image"""
    print_header(f"Testing on Single Image")

    image_path = Path(image_path)
    if not image_path.exists():
        print_error(f"Image not found: {image_path}")
        return

    print(f"  Image: {image_path}")

    # Run prediction
    results = model.predict(
        source=str(image_path),
        conf=0.25,
        save=False,
        verbose=True
    )

    if not results or len(results) == 0:
        print_warning("No results returned")
        return

    result = results[0]

    # Print detections
    boxes = result.boxes
    if boxes is not None and len(boxes) > 0:
        print_success(f"Found {len(boxes)} detections")
        for i, box in enumerate(boxes, 1):
            conf = float(box.conf[0])
            cls = int(box.cls[0])
            print(f"    Detection {i}: class={cls}, confidence={conf:.2f}")
    else:
        print_warning("No detections found")

    # Check keypoints
    if hasattr(result, 'keypoints') and result.keypoints is not None:
        kpts = result.keypoints
        print(f"  Keypoints detected: {len(kpts)}")

    # Save visualization
    if save_path:
        import cv2
        annotated = result.plot()
        cv2.imwrite(str(save_path), annotated)
        print_success(f"Visualization saved: {save_path}")


def generate_report(metrics, save_dir, model_path):
    """Generate HTML test report"""
    print_header("Generating Test Report")

    save_dir = Path(save_dir)
    report_path = save_dir / 'test_report.html'

    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    html = f'''<!DOCTYPE html>
<html>
<head>
    <title>YOLO Model Test Report</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 40px auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }}
        .header h1 {{
            margin: 0;
            font-size: 2.5em;
        }}
        .header p {{
            margin: 10px 0 0 0;
            opacity: 0.9;
        }}
        .section {{
            background: white;
            padding: 25px;
            margin-bottom: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        .section h2 {{
            margin-top: 0;
            color: #333;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }}
        .metrics {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }}
        .metric {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #667eea;
        }}
        .metric-value {{
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
            margin: 10px 0;
        }}
        .metric-label {{
            color: #666;
            font-size: 0.9em;
        }}
        .gallery {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }}
        .gallery img {{
            width: 100%;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }}
        .good {{ border-left-color: #10b981; }}
        .good .metric-value {{ color: #10b981; }}
        .medium {{ border-left-color: #f59e0b; }}
        .medium .metric-value {{ color: #f59e0b; }}
        .poor {{ border-left-color: #ef4444; }}
        .poor .metric-value {{ color: #ef4444; }}
        .info-table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }}
        .info-table td {{
            padding: 10px;
            border-bottom: 1px solid #eee;
        }}
        .info-table td:first-child {{
            font-weight: bold;
            color: #667eea;
            width: 200px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🎯 YOLO Model Test Report</h1>
        <p>Warhammer 40K Miniature Detection</p>
        <p>Generated: {timestamp}</p>
    </div>

    <div class="section">
        <h2>📋 Model Information</h2>
        <table class="info-table">
            <tr>
                <td>Model Path</td>
                <td>{model_path}</td>
            </tr>
            <tr>
                <td>Test Date</td>
                <td>{timestamp}</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <h2>📊 Validation Metrics</h2>
        <div class="metrics">
            <div class="metric {'good' if metrics.get('mAP50', 0) > 0.7 else 'medium' if metrics.get('mAP50', 0) > 0.5 else 'poor'}">
                <div class="metric-label">mAP @ 0.5</div>
                <div class="metric-value">{metrics.get('mAP50', 0):.1%}</div>
            </div>
            <div class="metric {'good' if metrics.get('mAP50-95', 0) > 0.5 else 'medium' if metrics.get('mAP50-95', 0) > 0.3 else 'poor'}">
                <div class="metric-label">mAP @ 0.5:0.95</div>
                <div class="metric-value">{metrics.get('mAP50-95', 0):.1%}</div>
            </div>
            <div class="metric {'good' if metrics.get('precision', 0) > 0.7 else 'medium' if metrics.get('precision', 0) > 0.5 else 'poor'}">
                <div class="metric-label">Precision</div>
                <div class="metric-value">{metrics.get('precision', 0):.1%}</div>
            </div>
            <div class="metric {'good' if metrics.get('recall', 0) > 0.7 else 'medium' if metrics.get('recall', 0) > 0.5 else 'poor'}">
                <div class="metric-label">Recall</div>
                <div class="metric-value">{metrics.get('recall', 0):.1%}</div>
            </div>
        </div>

        <h3 style="margin-top: 30px;">Interpretation</h3>
        <ul>
            <li><strong>mAP@0.5:</strong> {_interpret_map(metrics.get('mAP50', 0))}</li>
            <li><strong>Precision:</strong> {_interpret_precision(metrics.get('precision', 0))}</li>
            <li><strong>Recall:</strong> {_interpret_recall(metrics.get('recall', 0))}</li>
        </ul>
    </div>

    <div class="section">
        <h2>🖼️ Sample Predictions</h2>
        <p>See <code>predictions/</code> directory for full gallery</p>
    </div>

    <div class="section">
        <h2>💡 Recommendations</h2>
        {_get_recommendations(metrics)}
    </div>
</body>
</html>'''

    with open(report_path, 'w') as f:
        f.write(html)

    print_success(f"Report generated: {report_path}")
    print(f"  Open in browser: file://{report_path.absolute()}")


def _interpret_map(value):
    if value > 0.7:
        return "Excellent - Model performs very well at detecting miniatures"
    elif value > 0.5:
        return "Good - Model is reasonably accurate"
    elif value > 0.3:
        return "Fair - Model needs more training"
    else:
        return "Poor - Model needs significant improvement or more training data"


def _interpret_precision(value):
    if value > 0.7:
        return "High - Few false positives (good)"
    elif value > 0.5:
        return "Moderate - Some false detections"
    else:
        return "Low - Many false positives (needs tuning)"


def _interpret_recall(value):
    if value > 0.7:
        return "High - Finds most miniatures (good)"
    elif value > 0.5:
        return "Moderate - Misses some miniatures"
    else:
        return "Low - Misses many miniatures (needs more training)"


def _get_recommendations(metrics):
    recommendations = []

    map50 = metrics.get('mAP50', 0)
    precision = metrics.get('precision', 0)
    recall = metrics.get('recall', 0)

    if map50 < 0.5:
        recommendations.append("• Train for more epochs (50-100)")
        recommendations.append("• Increase dataset size if possible")
        recommendations.append("• Try data augmentation")

    if precision < 0.6:
        recommendations.append("• Increase confidence threshold to reduce false positives")
        recommendations.append("• Review false positives in predictions")

    if recall < 0.6:
        recommendations.append("• Lower confidence threshold to catch more detections")
        recommendations.append("• Check if small miniatures are being missed")
        recommendations.append("• Ensure all miniatures are annotated in training data")

    if precision > 0.8 and recall < 0.6:
        recommendations.append("• Model is too conservative - lower confidence threshold")

    if recall > 0.8 and precision < 0.6:
        recommendations.append("• Model is too aggressive - raise confidence threshold")

    if not recommendations:
        recommendations.append("• Model performance is good!")
        recommendations.append("• Consider fine-tuning on edge cases if needed")

    return "<ul>" + "".join(f"<li>{r}</li>" for r in recommendations) + "</ul>"


def main():
    parser = argparse.ArgumentParser(description='Test trained YOLO model')
    parser.add_argument('--model', required=True, help='Path to trained model (.pt file)')
    parser.add_argument('--dataset', default='backend/yolo_dataset', help='Path to dataset with data.yaml')
    parser.add_argument('--save-dir', default='test_results', help='Directory to save test results')
    parser.add_argument('--num-samples', type=int, default=20, help='Number of sample predictions to generate')
    parser.add_argument('--test-image', help='Test on a single image')
    parser.add_argument('--skip-validation', action='store_true', help='Skip validation metrics')
    parser.add_argument('--skip-gallery', action='store_true', help='Skip prediction gallery')
    args = parser.parse_args()

    print(f"{Colors.BOLD}{Colors.HEADER}")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║                                                            ║")
    print("║              YOLO Model Testing Harness                    ║")
    print("║                                                            ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print(f"{Colors.ENDC}\n")

    # Load model
    model = load_model(args.model)

    metrics = {}

    # Run validation
    if not args.skip_validation:
        metrics = run_validation(model, args.dataset) or {}

    # Create prediction gallery
    if not args.skip_gallery and not args.test_image:
        create_prediction_gallery(model, args.dataset, args.save_dir, args.num_samples)

    # Test single image
    if args.test_image:
        save_path = Path(args.save_dir) / 'single_test.jpg'
        test_on_image(model, args.test_image, save_path)

    # Generate report
    if metrics:
        generate_report(metrics, args.save_dir, args.model)

    print_header("Testing Complete")
    print_success(f"Results saved to: {args.save_dir}")


if __name__ == '__main__':
    main()
