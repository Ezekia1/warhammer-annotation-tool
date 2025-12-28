#!/usr/bin/env python3
"""
YOLO Training Environment Setup Script

Automates the setup of a complete YOLOv8-pose training environment:
- Creates Python virtual environment
- Installs YOLOv8 (ultralytics) and dependencies
- Checks GPU availability (CUDA/MPS)
- Validates exported dataset
- Downloads pretrained weights
- Provides training commands

Usage:
    python setup_training_env.py
    python setup_training_env.py --dataset-path backend/yolo_dataset
"""

import sys
import os
import subprocess
import platform
from pathlib import Path
import argparse


class Colors:
    """ANSI color codes for terminal output"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
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


def print_info(msg):
    print(f"{Colors.OKCYAN}ℹ {msg}{Colors.ENDC}")


def run_command(cmd, description, check=True, capture_output=False):
    """Run a shell command with nice output"""
    print(f"  Running: {description}...")
    try:
        if capture_output:
            result = subprocess.run(
                cmd,
                shell=True,
                check=check,
                capture_output=True,
                text=True
            )
            return result
        else:
            subprocess.run(cmd, shell=True, check=check)
            return None
    except subprocess.CalledProcessError as e:
        if check:
            print_error(f"Failed: {description}")
            if capture_output and e.stderr:
                print(f"  Error: {e.stderr}")
            raise
        return None


def check_python_version():
    """Ensure Python 3.8+"""
    print_header("Checking Python Version")

    version = sys.version_info
    print(f"  Python {version.major}.{version.minor}.{version.micro}")

    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print_error("Python 3.8 or higher required")
        print("  Please upgrade Python and try again")
        sys.exit(1)

    print_success("Python version OK")


def create_venv(venv_path):
    """Create Python virtual environment"""
    print_header("Creating Virtual Environment")

    if venv_path.exists():
        print_warning(f"Virtual environment already exists at {venv_path}")
        response = input("  Delete and recreate? (y/n): ")
        if response.lower() == 'y':
            import shutil
            shutil.rmtree(venv_path)
        else:
            print_info("Using existing virtual environment")
            return

    run_command(
        f'python3 -m venv {venv_path}',
        f"Creating venv at {venv_path}"
    )
    print_success(f"Virtual environment created at {venv_path}")


def get_pip_path(venv_path):
    """Get path to pip in virtual environment"""
    if platform.system() == 'Windows':
        return venv_path / 'Scripts' / 'pip'
    else:
        return venv_path / 'bin' / 'pip'


def get_python_path(venv_path):
    """Get path to python in virtual environment"""
    if platform.system() == 'Windows':
        return venv_path / 'Scripts' / 'python'
    else:
        return venv_path / 'bin' / 'python'


def install_dependencies(venv_path):
    """Install YOLOv8 and dependencies"""
    print_header("Installing YOLOv8 and Dependencies")

    pip = get_pip_path(venv_path)

    # Upgrade pip
    run_command(
        f'{pip} install --upgrade pip',
        "Upgrading pip"
    )

    # Install ultralytics (includes YOLOv8)
    print_info("Installing ultralytics (YOLOv8)...")
    print_info("This may take a few minutes...")
    run_command(
        f'{pip} install ultralytics',
        "Installing ultralytics"
    )

    # Install additional useful packages
    run_command(
        f'{pip} install PyYAML pillow matplotlib',
        "Installing additional packages"
    )

    print_success("Dependencies installed successfully")


def check_gpu_availability(venv_path):
    """Check for GPU acceleration (CUDA or MPS)"""
    print_header("Checking GPU Availability")

    python = get_python_path(venv_path)

    # Check PyTorch GPU support
    check_script = '''
import torch
print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"CUDA version: {torch.version.cuda}")
    print(f"GPU count: {torch.cuda.device_count()}")
    print(f"GPU name: {torch.cuda.get_device_name(0)}")
print(f"MPS available: {torch.backends.mps.is_available() if hasattr(torch.backends, 'mps') else False}")
'''

    result = run_command(
        f'{python} -c "{check_script}"',
        "Checking GPU support",
        check=False,
        capture_output=True
    )

    if result and result.returncode == 0:
        print(result.stdout)

        if 'CUDA available: True' in result.stdout:
            print_success("CUDA GPU detected - Training will use GPU acceleration")
        elif 'MPS available: True' in result.stdout:
            print_success("Apple Silicon GPU (MPS) detected - Training will use GPU acceleration")
        else:
            print_warning("No GPU detected - Training will use CPU (slower)")
            print_info("For faster training, consider using a machine with NVIDIA GPU (CUDA)")
    else:
        print_warning("Could not check GPU availability")


def validate_dataset(venv_path, dataset_path):
    """Run dataset validation"""
    print_header("Validating Dataset")

    if not dataset_path.exists():
        print_error(f"Dataset not found at {dataset_path}")
        print_info("Export your annotations first using /api/annotate/export")
        return False

    validator_script = Path(__file__).parent / 'validate_yolo_dataset.py'
    if not validator_script.exists():
        print_warning("Validator script not found, skipping validation")
        return True

    python = get_python_path(venv_path)

    result = run_command(
        f'{python} {validator_script} {dataset_path}',
        f"Validating dataset at {dataset_path}",
        check=False,
        capture_output=False
    )

    # Validator returns 0 on success, 1 on failure
    return result is None or result.returncode == 0


def download_pretrained_weights(venv_path):
    """Download YOLOv8 pose pretrained weights"""
    print_header("Downloading Pretrained Weights")

    python = get_python_path(venv_path)

    print_info("Downloading YOLOv8n-pose pretrained weights...")
    print_info("These weights will be used as starting point for training")

    download_script = '''
from ultralytics import YOLO
# This will download yolov8n-pose.pt on first use
model = YOLO('yolov8n-pose.pt')
print("Weights downloaded successfully")
'''

    try:
        run_command(
            f'{python} -c "{download_script}"',
            "Downloading yolov8n-pose.pt",
            check=True
        )
        print_success("Pretrained weights downloaded")
    except:
        print_warning("Could not download weights - they will download automatically during first training")


def create_training_script(venv_path, dataset_path):
    """Create a sample training script"""
    print_header("Creating Training Script")

    script_path = Path('train_yolo.py')

    python = get_python_path(venv_path)

    script_content = f'''#!/usr/bin/env python3
"""
YOLOv8-Pose Training Script for Warhammer 40K Miniatures

This script trains a YOLOv8-pose model to detect miniatures and their bases.

Usage:
    {python} train_yolo.py
    {python} train_yolo.py --epochs 100 --batch 16
"""

from ultralytics import YOLO
import argparse

def main():
    parser = argparse.ArgumentParser(description='Train YOLOv8-pose model')
    parser.add_argument('--data', default='{dataset_path}/data.yaml', help='Path to data.yaml')
    parser.add_argument('--epochs', type=int, default=50, help='Number of epochs')
    parser.add_argument('--batch', type=int, default=8, help='Batch size')
    parser.add_argument('--img-size', type=int, default=640, help='Image size')
    parser.add_argument('--device', default='', help='Device (cuda/mps/cpu, leave empty for auto)')
    parser.add_argument('--pretrained', default='yolov8n-pose.pt', help='Pretrained weights')
    args = parser.parse_args()

    print("=" * 60)
    print("YOLOv8-Pose Training - Warhammer 40K Miniatures")
    print("=" * 60)
    print(f"Dataset: {{args.data}}")
    print(f"Epochs: {{args.epochs}}")
    print(f"Batch size: {{args.batch}}")
    print(f"Image size: {{args.img_size}}")
    print(f"Device: {{args.device if args.device else 'auto'}}")
    print(f"Pretrained: {{args.pretrained}}")
    print("=" * 60)

    # Load pretrained YOLOv8-pose model
    model = YOLO(args.pretrained)

    # Train the model
    results = model.train(
        data=args.data,
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.img_size,
        device=args.device if args.device else None,
        project='runs/pose',
        name='miniature_detector',
        patience=10,  # Early stopping patience
        save=True,
        plots=True,
        val=True
    )

    print("\\n" + "=" * 60)
    print("Training complete!")
    print(f"Best weights saved to: runs/pose/miniature_detector/weights/best.pt")
    print("=" * 60)

if __name__ == '__main__':
    main()
'''

    with open(script_path, 'w') as f:
        f.write(script_content)

    # Make executable on Unix
    if platform.system() != 'Windows':
        os.chmod(script_path, 0o755)

    print_success(f"Training script created: {script_path}")


def print_next_steps(venv_path, dataset_path):
    """Print instructions for next steps"""
    print_header("Setup Complete! Next Steps")

    python = get_python_path(venv_path)

    print(f"{Colors.BOLD}1. Activate the virtual environment:{Colors.ENDC}")
    if platform.system() == 'Windows':
        print(f"   {venv_path}\\Scripts\\activate")
    else:
        print(f"   source {venv_path}/bin/activate")

    print(f"\n{Colors.BOLD}2. Validate your dataset:{Colors.ENDC}")
    print(f"   {python} scripts/validate_yolo_dataset.py {dataset_path}")

    print(f"\n{Colors.BOLD}3. Start training (Quick test - 10 epochs):{Colors.ENDC}")
    print(f"   {python} train_yolo.py --epochs 10 --batch 4")

    print(f"\n{Colors.BOLD}4. Full training (50+ epochs):{Colors.ENDC}")
    print(f"   {python} train_yolo.py --epochs 50 --batch 8")

    print(f"\n{Colors.BOLD}5. Advanced training options:{Colors.ENDC}")
    print(f"   {python} train_yolo.py --epochs 100 --batch 16 --img-size 800")
    print(f"   {python} train_yolo.py --help  # See all options")

    print(f"\n{Colors.BOLD}6. Monitor training:{Colors.ENDC}")
    print(f"   Training progress: runs/pose/miniature_detector/")
    print(f"   Best model: runs/pose/miniature_detector/weights/best.pt")
    print(f"   Plots: runs/pose/miniature_detector/*.png")

    print(f"\n{Colors.BOLD}Tips:{Colors.ENDC}")
    print(f"   • Start with a small test (--epochs 10) to verify everything works")
    print(f"   • Use larger batch size if you have GPU memory")
    print(f"   • Training 50+ epochs recommended for good accuracy")
    print(f"   • Check validation plots to avoid overfitting")

    print(f"\n{Colors.OKGREEN}Happy training! 🚀{Colors.ENDC}\n")


def main():
    parser = argparse.ArgumentParser(description='Setup YOLOv8 training environment')
    parser.add_argument(
        '--dataset-path',
        default='backend/yolo_dataset',
        help='Path to exported YOLO dataset (default: backend/yolo_dataset)'
    )
    parser.add_argument(
        '--venv-path',
        default='yolo_venv',
        help='Path for virtual environment (default: yolo_venv)'
    )
    parser.add_argument(
        '--skip-validation',
        action='store_true',
        help='Skip dataset validation'
    )
    args = parser.parse_args()

    venv_path = Path(args.venv_path)
    dataset_path = Path(args.dataset_path)

    print(f"{Colors.BOLD}{Colors.HEADER}")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║                                                            ║")
    print("║          YOLOv8-Pose Training Environment Setup            ║")
    print("║         Warhammer 40K Miniature Detection                 ║")
    print("║                                                            ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print(f"{Colors.ENDC}\n")

    try:
        # Step 1: Check Python version
        check_python_version()

        # Step 2: Create virtual environment
        create_venv(venv_path)

        # Step 3: Install dependencies
        install_dependencies(venv_path)

        # Step 4: Check GPU
        check_gpu_availability(venv_path)

        # Step 5: Validate dataset
        if not args.skip_validation:
            validate_dataset(venv_path, dataset_path)

        # Step 6: Download pretrained weights
        download_pretrained_weights(venv_path)

        # Step 7: Create training script
        create_training_script(venv_path, dataset_path)

        # Step 8: Print next steps
        print_next_steps(venv_path, dataset_path)

        print_success("Setup completed successfully!")

    except KeyboardInterrupt:
        print(f"\n\n{Colors.WARNING}Setup interrupted by user{Colors.ENDC}")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n{Colors.FAIL}Setup failed: {e}{Colors.ENDC}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
