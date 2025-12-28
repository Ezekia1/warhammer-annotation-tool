#!/usr/bin/env python3
"""
YOLO-Pose Dataset Validator
Validates exported dataset before training to catch errors early

Usage:
    python validate_yolo_dataset.py <dataset_path>
    python validate_yolo_dataset.py backend/yolo_dataset
"""

import sys
from pathlib import Path
import yaml


class DatasetValidator:
    def __init__(self, dataset_path):
        self.dataset_path = Path(dataset_path)
        self.errors = []
        self.warnings = []

    def validate(self):
        """Run all validation checks"""
        print("🔍 Validating YOLO-pose dataset...")
        print(f"Dataset path: {self.dataset_path}")
        print("=" * 60)

        # Check directory structure
        if not self.check_structure():
            return False

        # Load and validate data.yaml
        data_config = self.load_data_yaml()
        if not data_config:
            return False

        # Validate splits
        self.validate_split('train', data_config)
        self.validate_split('val', data_config)

        # Print report
        self.print_report()

        return len(self.errors) == 0

    def check_structure(self):
        """Check required directories exist"""
        print("\n📁 Checking directory structure...")

        required_dirs = [
            'images/train',
            'images/val',
            'labels/train',
            'labels/val'
        ]

        for dir_name in required_dirs:
            full_path = self.dataset_path / dir_name
            if not full_path.exists():
                self.errors.append(f"Missing directory: {dir_name}")
                print(f"  ❌ Missing: {dir_name}")
            else:
                # Count files
                files = list(full_path.glob('*'))
                print(f"  ✓ {dir_name}: {len(files)} files")

        if self.errors:
            return False

        print("  ✅ Directory structure OK")
        return True

    def load_data_yaml(self):
        """Load and validate data.yaml"""
        print("\n📄 Validating data.yaml...")

        yaml_path = self.dataset_path / 'data.yaml'
        if not yaml_path.exists():
            self.errors.append("Missing data.yaml")
            return None

        try:
            with open(yaml_path) as f:
                config = yaml.safe_load(f)
        except Exception as e:
            self.errors.append(f"Failed to parse data.yaml: {e}")
            return None

        # Check required fields
        required_fields = ['train', 'val', 'nc', 'names', 'kpt_shape']
        for field in required_fields:
            if field not in config:
                self.errors.append(f"data.yaml missing field: {field}")

        # Validate kpt_shape for pose
        if 'kpt_shape' in config:
            kpt_shape = config['kpt_shape']
            if not isinstance(kpt_shape, list) or len(kpt_shape) != 2:
                self.errors.append(f"Invalid kpt_shape format: {kpt_shape} (expected [n_kpts, n_values])")
            elif kpt_shape != [4, 3]:
                self.errors.append(
                    f"Invalid kpt_shape: {kpt_shape} (expected [4, 3] for base corners)"
                )
            else:
                print(f"  ✓ kpt_shape: {kpt_shape} (4 keypoints, 3 values each)")

        # Validate class count
        if 'nc' in config and 'names' in config:
            if config['nc'] != len(config['names']):
                self.errors.append(
                    f"Class count mismatch: nc={config['nc']} but {len(config['names'])} names provided"
                )
            else:
                print(f"  ✓ Classes: {config['nc']} ({', '.join(config['names'])})")

        # Check for single class (recommended)
        if config.get('nc') != 1:
            self.warnings.append(
                f"Multi-class detected: nc={config.get('nc')} (expected 1 for 'miniature')"
            )

        if not self.errors:
            print("  ✅ data.yaml OK")

        return config

    def validate_split(self, split, data_config):
        """Validate train or val split"""
        print(f"\n🔍 Validating {split} split...")

        images_dir = self.dataset_path / 'images' / split
        labels_dir = self.dataset_path / 'labels' / split

        if not images_dir.exists() or not labels_dir.exists():
            return

        # Get file lists
        image_files = {f.stem: f for f in images_dir.glob('*') if f.suffix in ['.jpg', '.jpeg', '.png']}
        label_files = {f.stem: f for f in labels_dir.glob('*.txt')}

        print(f"  Images: {len(image_files)}")
        print(f"  Labels: {len(label_files)}")

        # Check for missing labels
        missing_labels = set(image_files.keys()) - set(label_files.keys())
        if missing_labels:
            self.errors.append(
                f"{split}: {len(missing_labels)} images without labels"
            )
            print(f"  ❌ {len(missing_labels)} images without labels")
            if len(missing_labels) <= 5:
                for stem in list(missing_labels)[:5]:
                    print(f"     - {stem}")

        # Check for orphaned labels
        orphaned_labels = set(label_files.keys()) - set(image_files.keys())
        if orphaned_labels:
            self.warnings.append(
                f"{split}: {len(orphaned_labels)} labels without images"
            )
            print(f"  ⚠️  {len(orphaned_labels)} labels without images")

        # Validate label files
        print(f"  Validating label content...")
        label_count = 0
        instance_count = 0
        pose_count = 0

        for label_file in label_files.values():
            issues = self.validate_label_file(label_file, data_config.get('nc', 1), split)
            if not issues:
                label_count += 1
                # Count instances
                with open(label_file) as f:
                    lines = [l.strip() for l in f if l.strip()]
                    instance_count += len(lines)
                    # Count pose instances (17 values)
                    pose_count += sum(1 for l in lines if len(l.split()) == 17)

        print(f"  ✓ Valid labels: {label_count}/{len(label_files)}")
        print(f"  ✓ Total instances: {instance_count}")
        print(f"  ✓ Instances with pose: {pose_count} ({pose_count/max(instance_count,1)*100:.1f}%)")

        if label_count == len(label_files) and len(missing_labels) == 0:
            print(f"  ✅ {split} split OK")

    def validate_label_file(self, label_path, num_classes, split):
        """Validate a single label file"""
        issues = []

        try:
            with open(label_path) as f:
                lines = [line.strip() for line in f if line.strip()]
        except Exception as e:
            self.errors.append(f"{split}/{label_path.name}: Failed to read file: {e}")
            return ['read_error']

        # Empty file is valid (no objects)
        if not lines:
            return []

        for line_num, line in enumerate(lines, 1):
            parts = line.split()

            # Check format: standard (5 values) or pose (17 values)
            if len(parts) not in [5, 17]:
                self.errors.append(
                    f"{split}/{label_path.name}:{line_num} - "
                    f"Invalid format: expected 5 (bbox) or 17 (bbox+pose) values, got {len(parts)}"
                )
                issues.append('format')
                continue

            # Validate class ID
            try:
                class_id = int(parts[0])
                if class_id < 0 or class_id >= num_classes:
                    self.errors.append(
                        f"{split}/{label_path.name}:{line_num} - "
                        f"Invalid class ID: {class_id} (must be 0-{num_classes-1})"
                    )
                    issues.append('class')
            except ValueError:
                self.errors.append(
                    f"{split}/{label_path.name}:{line_num} - "
                    f"Class ID must be integer, got: {parts[0]}"
                )
                issues.append('class')

            # Validate bbox coordinates (normalized 0-1)
            try:
                x, y, w, h = [float(v) for v in parts[1:5]]

                # Check center in range
                if x < 0 or x > 1 or y < 0 or y > 1:
                    self.errors.append(
                        f"{split}/{label_path.name}:{line_num} - "
                        f"Bbox center out of range: x={x:.3f}, y={y:.3f} (must be 0-1)"
                    )
                    issues.append('bbox_center')

                # Check size in range
                if w <= 0 or w > 1 or h <= 0 or h > 1:
                    self.errors.append(
                        f"{split}/{label_path.name}:{line_num} - "
                        f"Bbox size invalid: w={w:.3f}, h={h:.3f} (must be 0-1, >0)"
                    )
                    issues.append('bbox_size')

            except (ValueError, IndexError) as e:
                self.errors.append(
                    f"{split}/{label_path.name}:{line_num} - "
                    f"Invalid bbox coordinates: {e}"
                )
                issues.append('bbox_parse')

            # Validate keypoints (if present)
            if len(parts) == 17:
                try:
                    keypoints = [float(v) for v in parts[5:]]

                    # Should have 4 keypoints * 3 values = 12 values
                    if len(keypoints) != 12:
                        self.errors.append(
                            f"{split}/{label_path.name}:{line_num} - "
                            f"Invalid keypoint count: {len(keypoints)} values (expected 12)"
                        )
                        issues.append('kpt_count')
                        continue

                    # Validate each keypoint
                    for i in range(4):
                        kx = keypoints[i * 3]
                        ky = keypoints[i * 3 + 1]
                        kv = keypoints[i * 3 + 2]

                        # Check coordinates in range
                        if kx < 0 or kx > 1 or ky < 0 or ky > 1:
                            self.errors.append(
                                f"{split}/{label_path.name}:{line_num} - "
                                f"Keypoint {i} out of range: ({kx:.3f}, {ky:.3f})"
                            )
                            issues.append('kpt_coords')

                        # Check visibility flag (must be 0 or 1)
                        if kv not in [0, 1, 0.0, 1.0]:
                            self.errors.append(
                                f"{split}/{label_path.name}:{line_num} - "
                                f"Keypoint {i} invalid visibility: {kv} (must be 0 or 1)"
                            )
                            issues.append('kpt_visibility')

                    # Check keypoint ordering (basic sanity check)
                    # TL, TR, BR, BL should form a rectangle
                    corners = [
                        (keypoints[0], keypoints[1]),  # TL
                        (keypoints[3], keypoints[4]),  # TR
                        (keypoints[6], keypoints[7]),  # BR
                        (keypoints[9], keypoints[10])  # BL
                    ]

                    # Very basic check: TR should be to the right of TL
                    if corners[1][0] < corners[0][0]:
                        self.warnings.append(
                            f"{split}/{label_path.name}:{line_num} - "
                            f"Keypoint order suspicious: TR not right of TL"
                        )
                        issues.append('kpt_order')

                except (ValueError, IndexError) as e:
                    self.errors.append(
                        f"{split}/{label_path.name}:{line_num} - "
                        f"Invalid keypoint data: {e}"
                    )
                    issues.append('kpt_parse')

        # Check for overlapping instances (>50% IoU)
        if len(lines) > 1:
            overlaps = self.check_overlaps(lines, label_path.name, split)
            if overlaps:
                issues.extend(overlaps)

        return issues

    def check_overlaps(self, lines, filename, split):
        """Check for overlapping bounding boxes"""
        issues = []
        bboxes = []

        for line in lines:
            parts = line.split()
            if len(parts) >= 5:
                try:
                    x, y, w, h = [float(v) for v in parts[1:5]]
                    bboxes.append((x, y, w, h))
                except:
                    pass  # Already reported parsing error

        for i in range(len(bboxes)):
            for j in range(i + 1, len(bboxes)):
                iou = self.calculate_iou(bboxes[i], bboxes[j])
                if iou > 0.5:
                    self.warnings.append(
                        f"{split}/{filename} - "
                        f"High overlap ({iou*100:.0f}%) between instances {i+1} and {j+1} - verify not duplicate"
                    )
                    issues.append('overlap')

        return issues

    def calculate_iou(self, bbox1, bbox2):
        """Calculate IoU for normalized YOLO bboxes (cx, cy, w, h)"""
        # Convert center+size to corners
        x1_1 = bbox1[0] - bbox1[2] / 2
        y1_1 = bbox1[1] - bbox1[3] / 2
        x2_1 = bbox1[0] + bbox1[2] / 2
        y2_1 = bbox1[1] + bbox1[3] / 2

        x1_2 = bbox2[0] - bbox2[2] / 2
        y1_2 = bbox2[1] - bbox2[3] / 2
        x2_2 = bbox2[0] + bbox2[2] / 2
        y2_2 = bbox2[1] + bbox2[3] / 2

        # Calculate intersection
        x1_i = max(x1_1, x1_2)
        y1_i = max(y1_1, y1_2)
        x2_i = min(x2_1, x2_2)
        y2_i = min(y2_1, y2_2)

        if x2_i < x1_i or y2_i < y1_i:
            return 0.0  # No overlap

        intersection = (x2_i - x1_i) * (y2_i - y1_i)
        area1 = bbox1[2] * bbox1[3]
        area2 = bbox2[2] * bbox2[3]
        union = area1 + area2 - intersection

        return intersection / union if union > 0 else 0.0

    def print_report(self):
        """Print validation report"""
        print("\n" + "=" * 60)
        print("VALIDATION REPORT")
        print("=" * 60)

        if self.errors:
            print(f"\n❌ {len(self.errors)} ERRORS:")
            for i, err in enumerate(self.errors[:20], 1):
                print(f"  {i}. {err}")
            if len(self.errors) > 20:
                print(f"  ... and {len(self.errors) - 20} more errors")

        if self.warnings:
            print(f"\n⚠️  {len(self.warnings)} WARNINGS:")
            for i, warn in enumerate(self.warnings[:20], 1):
                print(f"  {i}. {warn}")
            if len(self.warnings) > 20:
                print(f"  ... and {len(self.warnings) - 20} more warnings")

        if not self.errors and not self.warnings:
            print("\n✅ Dataset validation passed!")
            print("   No errors or warnings found.")
            print("   Dataset is ready for training!")
        elif not self.errors:
            print("\n✅ No errors found!")
            print("   Warnings can usually be ignored or are informational.")
            print("   Dataset is ready for training.")
        else:
            print("\n❌ Validation failed!")
            print("   Fix errors before training.")
            print("   Training on invalid data will fail or produce poor results.")

        print("=" * 60)


def main():
    if len(sys.argv) != 2:
        print("Usage: python validate_yolo_dataset.py <dataset_path>")
        print("Example: python validate_yolo_dataset.py backend/yolo_dataset")
        sys.exit(1)

    dataset_path = sys.argv[1]
    validator = DatasetValidator(dataset_path)
    success = validator.validate()

    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
