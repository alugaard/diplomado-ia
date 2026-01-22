import time
import torch
from utils import load_beto_once, predict_texts

def benchmark():
    print("Loading model...")
    load_beto_once()
    
    # Simulate 100 comments
    test_comments = ["Este es un comentario de prueba para benchmarking."] * 100
    
    print(f"Starting benchmark for {len(test_comments)} comments on CPU...")
    start_time = time.time()
    
    preds, probas, classes = predict_texts(test_comments, batch_size=32)
    
    end_time = time.time()
    duration = end_time - start_time
    
    print(f"\nTotal time: {duration:.2f} seconds")
    print(f"Time per comment: {(duration / len(test_comments)) * 1000:.2f} ms")
    print(f"Estimated time for 1000 comments: {(duration * 10):.2f} seconds")

if __name__ == "__main__":
    benchmark()
