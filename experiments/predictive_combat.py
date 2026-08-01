import os
import sys
import io
import random
import numpy as np

from engine import Player, Card

def run_logged_simulation(faksi_1_name, file_json_1, faksi_2_name, file_json_2):
    p1 = Player(faksi_1_name)
    p2 = Player(faksi_2_name)
    
    p1.load_deck_from_json(file_json_1)
    p2.load_deck_from_json(file_json_2)
    
    p1.setup_phase()
    p2.setup_phase()
    
    # Record starting hand counts of Card A (Yudhistira/Balarama/Sengkuni)
    # The first card in the JSON is Card A. Let's find its name.
    card_a_name_1 = p1.deck[0].name # The deck is shuffled but we can check raw JSON data
    # Actually, let's load from JSON to find card names
    with open(file_json_1, 'r') as f:
        card_a_name_1 = json_load_name(f, 0)
    with open(file_json_2, 'r') as f:
        card_a_name_2 = json_load_name(f, 0)
        
    p1_card_a_count = sum(1 for card in p1.hand if card.name == card_a_name_1)
    p2_card_a_count = sum(1 for card in p2.hand if card.name == card_a_name_2)
    
    p1.play_basic_to_active()
    p2.play_basic_to_active()
    p1.play_basic_to_bench()
    p2.play_basic_to_bench()
    
    players = [p1, p2]
    random.shuffle(players)
    first_player = players[0]
    second_player = players[1]
    
    p1_is_first = 1 if first_player.name == faksi_1_name else 0
    
    turn = 1
    game_active = True
    winner = None
    
    while game_active and turn <= 100:
        first_player.attach_prana()
        res = first_player.attack(opponent=second_player)
        if res in ["GAME_OVER", "GAME_OVER_SUICIDE"]:
            game_active = False
            winner = first_player.name if res == "GAME_OVER" else second_player.name
            break
            
        second_player.attach_prana()
        res = second_player.attack(opponent=first_player)
        if res in ["GAME_OVER", "GAME_OVER_SUICIDE"]:
            game_active = False
            winner = second_player.name if res == "GAME_OVER" else first_player.name
            break
            
        turn += 1
        
    if not winner:
        hp1 = p1.active_character.current_hp if p1.active_character else 0
        hp2 = p2.active_character.current_hp if p2.active_character else 0
        winner = faksi_1_name if hp1 >= hp2 else faksi_2_name
        
    label = 1 if winner == faksi_1_name else 0
    return p1_card_a_count, p2_card_a_count, p1_is_first, label

def json_load_name(file_handle, index):
    data = json.load(file_handle)
    return data["cards"][index]["name"]

import json

# Logistic Regression implementation in pure Numpy
class LogisticRegression:
    def __init__(self, lr=0.05, epochs=1000):
        self.lr = lr
        self.epochs = epochs
        self.weights = None
        
    def _sigmoid(self, z):
        return 1.0 / (1.0 + np.exp(-np.clip(z, -20, 20)))
        
    def fit(self, X, y):
        num_samples, num_features = X.shape
        # Add bias column
        X_bias = np.hstack([np.ones((num_samples, 1)), X])
        self.weights = np.zeros(num_features + 1)
        
        for epoch in range(self.epochs):
            linear_model = np.dot(X_bias, self.weights)
            predictions = self._sigmoid(linear_model)
            
            # Gradient descent
            dw = (1.0 / num_samples) * np.dot(X_bias.T, (predictions - y))
            self.weights -= self.lr * dw
            
    def predict_proba(self, X):
        num_samples = X.shape[0]
        X_bias = np.hstack([np.ones((num_samples, 1)), X])
        return self._sigmoid(np.dot(X_bias, self.weights))
        
    def predict(self, X):
        return [1 if p >= 0.5 else 0 for p in self.predict_proba(X)]

def train_predictive_model():
    print("=== MENGUMPULKAN DATA SIMULASI (N = 3000) ===")
    
    matchups = [
        ("PANDAWA", "data/satwika.json", "KURAWA", "data/tamasika.json", 1, 0),
        ("KURAWA", "data/tamasika.json", "RAJASIKA", "data/rajasika.json", 0, 1),
        ("RAJASIKA", "data/rajasika.json", "PANDAWA", "data/satwika.json", 0, 0)
    ]
    
    dataset = []
    
    original_stdout = sys.stdout
    sys.stdout = io.StringIO()
    
    try:
        for name1, json1, name2, json2, pvk, kvr in matchups:
            for _ in range(1000):
                p1_a, p2_a, p1_first, label = run_logged_simulation(name1, json1, name2, json2)
                # Features: p1_card_a, p2_card_a, p1_is_first, matchup_pvk, matchup_kvr
                dataset.append([p1_a, p2_a, p1_first, pvk, kvr, label])
    finally:
        sys.stdout = original_stdout
        
    data = np.array(dataset)
    X = data[:, :5] # first 5 columns are features
    y = data[:, 5]  # last column is target label
    
    # Shuffle dataset
    indices = np.arange(X.shape[0])
    np.random.seed(42)
    np.random.shuffle(indices)
    X = X[indices]
    y = y[indices]
    
    # Split 80/20 train/test
    split = int(0.8 * X.shape[0])
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]
    
    # Train Logistic Regression
    model = LogisticRegression(lr=0.1, epochs=1500)
    model.fit(X_train, y_train)
    
    # Evaluate
    train_preds = model.predict(X_train)
    test_preds = model.predict(X_test)
    
    train_acc = np.mean(train_preds == y_train) * 100
    test_acc = np.mean(test_preds == y_test) * 100
    
    print("\n=== HASIL PELATIHAN MODEL PREDIKTIF ===")
    print(f"Akurasi Model pada Data Training: {train_acc:.2f}%")
    print(f"Akurasi Model pada Data Testing : {test_acc:.2f}%")
    
    # Print Weights
    feature_names = ["Intercept (Bias)", "Starting Hand: Jumlah Card A P1", "Starting Hand: Jumlah Card A P2", "Coin Toss: P1 Jalan Pertama", "Matchup: Pandawa vs Kurawa", "Matchup: Kurawa vs Rajasika"]
    print("\nBobot Fitur Model (Feature Weights):")
    for name, weight in zip(feature_names, model.weights):
        print(f"  - {name:<35}: {weight:+.4f}")
        
    print("\nInterpretasi Bobot:")
    # Intercept tells baseline bias
    # Card A P1 vs Card A P2
    print("  * Nilai bobot positif untuk Starting Hand P1 berarti semakin banyak kartu Lead (Yudhistira/Sengkuni/Balarama) ditarik di tangan awal P1, semakin besar peluang menang P1.")
    print("  * Nilai bobot positif untuk Coin Toss berarti pemain yang jalan pertama memiliki keunggulan (tempo advantage).")

if __name__ == "__main__":
    train_predictive_model()
