import torch
import sys

def check_gpu():
    print(f"Python version: {sys.version}")
    print(f"PyTorch version: {torch.__version__}")
    
    if torch.cuda.is_available():
        print("✅ CUDA is available (NVIDIA GPU)")
        device = torch.device("cuda")
    elif torch.backends.mps.is_available():
        print("✅ MPS is available (Apple Silicon / AMD GPU on Mac)")
        device = torch.device("mps")
    else:
        print("⚠️ No GPU detected. Using CPU.")
        print("NOTE: If you are on a Mac M1/M2/M3, ensure you have installed PyTorch with MPS support.")
        device = torch.device("cpu")
        
    print(f"Selected device: {device}")
    
    try:
        x = torch.rand(5, 3).to(device)
        print("Tensor operation test passed:")
        print(x)
    except Exception as e:
        print(f"❌ Tensor operation failed: {e}")

if __name__ == "__main__":
    check_gpu()
