import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import io
import json
import random
import numpy as np

from src.simulator.engine import run_logged_simulation
from src.infrastructure.ml.decision_tree_classifier import RandomForestClassifier
from src.surrogate.mlp import run_surrogate_training

def run_ml_experiments():
    print("=== MAHAYUDHA TCG MACHINE LEARNING & DEEP LEARNING EXPERIMENTS ===")
    
    # 1. Gather starting hand data for Random Forest
    print("\n--- 1. MENGEKSTRAKSI DATA DAN MELATIH RANDOM FOREST CLASSIVER ---")
    matchups = [
        ("PANDAWA", "data/satwika.json", "KURAWA", "data/tamasika.json"),
        ("KURAWA", "data/tamasika.json", "RAJASIKA", "data/rajasika.json"),
        ("RAJASIKA", "data/rajasika.json", "PANDAWA", "data/satwika.json")
    ]
    
    dataset = []
    original_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        for name1, json1, name2, json2 in matchups:
            for _ in range(300):
                p1_a, p2_a, p1_first, turns, winner_hp, label = run_logged_simulation(name1, json1, name2, json2)
                # Feature vector: [P1 Yudhistira Count, P2 Sengkuni Count, P1 Is First]
                dataset.append([p1_a, p2_a, p1_first, label])
    finally:
        sys.stdout = original_stdout
        
    X = np.array([row[:3] for row in dataset])
    y = np.array([row[3] for row in dataset])
    
    # Train / Test split
    indices = np.arange(X.shape[0])
    np.random.seed(42)
    np.random.shuffle(indices)
    X, y = X[indices], y[indices]
    split = int(0.8 * X.shape[0])
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]
    
    rf = RandomForestClassifier(n_estimators=5, max_depth=3)
    rf.fit(X_train, y_train)
    
    train_acc = np.mean(rf.predict(X_train) == y_train) * 100
    test_acc = np.mean(rf.predict(X_test) == y_test) * 100
    
    print(f"Akurasi Random Forest (Training): {train_acc:.2f}%")
    print(f"Akurasi Random Forest (Testing) : {test_acc:.2f}%")
    
    # 2. Train Surrogate Neural Network
    print("\n--- 2. MELATIH DEEP NEURAL NETWORK SURROGATE & GA-MLP OPTIMIZER ---")
    run_surrogate_training(num_samples=100)

if __name__ == "__main__":
    run_ml_experiments()
