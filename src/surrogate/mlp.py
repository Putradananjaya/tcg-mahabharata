import time
import copy
import random
import numpy as np
from src.simulator.fitness import BOUNDS, SMART_START, evaluate_chromosome

class MLPSurrogate:
    def __init__(self, input_dim=25, hidden_dim=16, output_dim=3, seed=None):
        # NOTE (Fase 6 review): this used to call the GLOBAL np.random.seed(42)
        # here, which (a) reset the process-wide numpy RNG as a side effect of
        # constructing an object, and (b) gave every MLPSurrogate instance
        # IDENTICAL initial weights -- fatal for a deep ensemble (Fase 6 task
        # 2), which needs diverse initialization across members to produce a
        # meaningful disagreement-based uncertainty estimate. Now uses a
        # private np.random.Generator seeded per-instance; `seed=None` (the
        # default) draws fresh entropy instead of a fixed constant.
        rng = np.random.default_rng(seed)
        self.w1 = rng.standard_normal((input_dim, hidden_dim)) * 0.1
        self.b1 = np.zeros((1, hidden_dim))
        self.w2 = rng.standard_normal((hidden_dim, output_dim)) * 0.1
        self.b2 = np.zeros((1, output_dim))

    def _sigmoid(self, x):
        return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))

    def _sigmoid_derivative(self, s):
        return s * (1.0 - s)

    def forward(self, x):
        self.z1 = np.dot(x, self.w1) + self.b1
        self.a1 = self._sigmoid(self.z1)
        self.z2 = np.dot(self.a1, self.w2) + self.b2
        # Scale output from sigmoid [0,1] to represent win rate [0,100]%
        self.a2 = self._sigmoid(self.z2) * 100.0
        return self.a2

    def backward(self, x, y, output, learning_rate=0.01):
        m = x.shape[0]
        # Loss derivative w.r.t output (scaled)
        error = (output - y) / 100.0
        
        # Output layer gradients
        d_z2 = error * self._sigmoid_derivative(output / 100.0)
        d_w2 = np.dot(self.a1.T, d_z2) / m
        d_b2 = np.sum(d_z2, axis=0, keepdims=True) / m
        
        # Hidden layer gradients
        d_a1 = np.dot(d_z2, self.w2.T)
        d_z1 = d_a1 * self._sigmoid_derivative(self.a1)
        d_w1 = np.dot(x.T, d_z1) / m
        d_b1 = np.sum(d_z1, axis=0, keepdims=True) / m
        
        # Weights update
        self.w2 -= learning_rate * d_w2
        self.b2 -= learning_rate * d_b2
        self.w1 -= learning_rate * d_w1
        self.b1 -= learning_rate * d_b1

def generate_perturbed_position():
    pos = {}
    for key, val in SMART_START.items():
        low, high = BOUNDS[key]
        perturb = int(random.gauss(0, (high - low) * 0.08))
        pos[key] = max(low, min(high, val + perturb))
    return pos

def dict_to_array(d):
    keys = sorted(BOUNDS.keys())
    return np.array([d[k] for k in keys], dtype=float)

def array_to_dict(arr):
    keys = sorted(BOUNDS.keys())
    return {keys[i]: int(round(arr[i])) for i in range(len(keys))}

def run_surrogate_training(num_samples=150):
    print(f"=== TAHAP 1: MENGUMPULKAN DATASET SIMULATOR ({num_samples} MANIFOLD SAMPLES) ===")
    X_list, y_list = [], []
    for i in range(num_samples):
        pos = generate_perturbed_position()
        loss, rates = evaluate_chromosome(pos, num_runs=60)
        
        x_vec = dict_to_array(pos)
        y_vec = np.array([rates["SATWIKA_vs_TAMASIKA"], rates["TAMASIKA_vs_RAJASIKA"], rates["RAJASIKA_vs_SATWIKA"]])
        
        X_list.append(x_vec)
        y_list.append(y_vec)
        
        if (i+1) % 25 == 0:
            print(f"  Sampel dikumpulkan: {i+1}/{num_samples}...")
            
    X = np.array(X_list)
    y = np.array(y_list)
    
    # Normalize inputs for Neural Network stability
    X_mean = np.mean(X, axis=0)
    X_std = np.std(X, axis=0)
    X_std[X_std == 0] = 1.0
    X_norm = (X - X_mean) / X_std
    
    # --- TAHAP 2: TRAINING SURROGATE MLP ---
    print("\n=== TAHAP 2: TRAINING SURROGATE DEEP NEURAL NETWORK ===")
    mlp = MLPSurrogate(input_dim=25, hidden_dim=16, output_dim=3)
    
    epochs = 2001
    for epoch in range(epochs):
        preds = mlp.forward(X_norm)
        # Compute Mean Squared Error (normalized to 0-1 range for loss display)
        loss = np.mean((preds - y) ** 2) / 10000.0
        
        mlp.backward(X_norm, y, preds, learning_rate=0.03)
        if epoch % 500 == 0:
            print(f"    Epoch {epoch:<6} | MSE Loss: {loss:.6f}")
            
    # --- TAHAP 3: GA-MLP PROXY OPTIMIZATION ---
    print("\n=== TAHAP 3: RUNNING GENETIC ALGORITHM DI ATAS NEURAL SURROGATE (GA-MLP) ===")
    
    # Fitness evaluation w.r.t the Neural Network surrogate
    def nn_fitness(chromo_dict):
        x_norm_vec = (dict_to_array(chromo_dict) - X_mean) / X_std
        pred_wr = mlp.forward(x_norm_vec.reshape(1, -1))[0]
        # Return squared error from 50% target
        loss = (pred_wr[0] - 50.0)**2 + (pred_wr[1] - 50.0)**2 + (pred_wr[2] - 50.0)**2
        return loss

    pop_size = 12
    population = [generate_perturbed_position() for _ in range(pop_size)]
    population[0] = SMART_START.copy()
    
    start_time = time.time()
    
    for gen in range(100):
        fitness_scores = []
        for chromo in population:
            loss = nn_fitness(chromo)
            fitness_scores.append((loss, chromo))
            
        fitness_scores.sort(key=lambda x: x[0])
        
        new_pop = [copy.deepcopy(fitness_scores[0][1]), copy.deepcopy(fitness_scores[1][1])]
        while len(new_pop) < pop_size:
            p1 = random.choice(fitness_scores[:4])[1]
            p2 = random.choice(fitness_scores[:4])[1]
            
            # Simple Crossover
            child = {}
            for k in BOUNDS.keys():
                child[k] = p1[k] if random.random() < 0.5 else p2[k]
                
            # Mutation
            for k, (low, high) in BOUNDS.items():
                if random.random() < 0.15:
                    step = int(random.gauss(0, (high-low)*0.05))
                    child[k] = max(low, min(high, child[k] + step))
            new_pop.append(child)
        population = new_pop
        
    best_loss = fitness_scores[0][0]
    best_chromo = fitness_scores[0][1]
    elapsed = time.time() - start_time
    print(f"GA-MLP Selesai!")
    print(f"Waktu GA di atas Neural Network: {elapsed:.4f} detik (Untuk 100 generasi!)")
    
    # --- TAHAP 4: VALIDASI DI SIMULATOR ASLI ---
    print("\n=== TAHAP 4: VALIDASI AKHIR RUN SIMULATOR ASLI (N = 1000) ===")
    val_loss, val_rates = evaluate_chromosome(best_chromo, num_runs=1000)
    print(f"Hasil Win Rate Kartu Hasil Optimasi Neural Network pada Simulator Asli:")
    for matchup, wr in val_rates.items():
        print(f"  - {matchup} : {wr:.2f}%")
    print(f"Loss Hasil Validasi Simulator: {val_loss:.2f}")
    
    return best_chromo
