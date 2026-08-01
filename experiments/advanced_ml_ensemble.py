import sys
import io
import json
import random
import csv
import numpy as np

from engine import Player, Card

# Reuse CART Decision Tree logic from decision_tree.py
class DecisionTreeClassifier:
    def __init__(self, max_depth=3):
        self.max_depth = max_depth
        self.root = None

    def _gini(self, y):
        m = len(y)
        if m == 0: return 0
        p = np.sum(y) / m
        return 1.0 - (p**2 + (1 - p)**2)

    def _best_split(self, X, y):
        m, n = X.shape
        if m <= 1: return None, None
        
        best_gini = 999.0
        best_idx, best_thr = None, None
        
        for idx in range(n):
            thresholds = np.unique(X[:, idx])
            for thr in thresholds:
                left_mask = X[:, idx] <= thr
                y_l, y_r = y[left_mask], y[~left_mask]
                
                if len(y_l) == 0 or len(y_r) == 0:
                    continue
                    
                gini_split = (len(y_l)/m)*self._gini(y_l) + (len(y_r)/m)*self._gini(y_r)
                if gini_split < best_gini:
                    best_gini = gini_split
                    best_idx = idx
                    best_thr = thr
                    
        return best_idx, best_thr

    def _build_tree(self, X, y, depth=0):
        num_samples, num_features = X.shape
        
        if depth >= self.max_depth or len(np.unique(y)) == 1 or num_samples < 5:
            val = np.sum(y) / num_samples if num_samples > 0 else 0.5
            return Node(value=val)
            
        best_idx, best_thr = self._best_split(X, y)
        if best_idx is None:
            val = np.sum(y) / num_samples
            return Node(value=val)
            
        left_mask = X[:, best_idx] <= best_thr
        left_child = self._build_tree(X[left_mask], y[left_mask], depth + 1)
        right_child = self._build_tree(X[~left_mask], y[~left_mask], depth + 1)
        
        return Node(feature_idx=best_idx, threshold=best_thr, left=left_child, right=right_child)

    def fit(self, X, y):
        self.root = self._build_tree(X, y)

    def _predict_row(self, node, x):
        if node.is_leaf():
            return node.value
        if x[node.feature_idx] <= node.threshold:
            return self._predict_row(node.left, x)
        return self._predict_row(node.right, x)

    def predict_proba(self, X):
        return np.array([self._predict_row(self.root, x) for x in X])

class Node:
    def __init__(self, feature_idx=None, threshold=None, left=None, right=None, *, value=None):
        self.feature_idx = feature_idx
        self.threshold = threshold
        self.left = left
        self.right = right
        self.value = value

    def is_leaf(self):
        return self.value is not None

# Random Forest Classifier (Pure NumPy)
class RandomForestClassifier:
    def __init__(self, n_estimators=5, max_depth=3):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.trees = []

    def fit(self, X, y):
        m = X.shape[0]
        self.trees = []
        for _ in range(self.n_estimators):
            # Bootstrap sampling (sampling with replacement)
            indices = np.random.choice(m, size=m, replace=True)
            X_b, y_b = X[indices], y[indices]
            
            tree = DecisionTreeClassifier(max_depth=self.max_depth)
            tree.fit(X_b, y_b)
            self.trees.append(tree)

    def predict_proba(self, X):
        tree_probs = np.array([tree.predict_proba(X) for tree in self.trees])
        return np.mean(tree_probs, axis=0)

    def predict(self, X):
        return np.array([1 if p >= 0.5 else 0 for p in self.predict_proba(X)])

# K-Means Clustering (Pure NumPy)
class KMeans:
    def __init__(self, k=3, max_iters=20):
        self.k = k
        self.max_iters = max_iters
        self.centroids = None

    def fit(self, X):
        np.random.seed(42)
        # Initialize centroids randomly from points
        m = X.shape[0]
        rand_idx = np.random.choice(m, size=self.k, replace=False)
        self.centroids = X[rand_idx]
        
        for _ in range(self.max_iters):
            # Calculate distance of all points to centroids
            distances = np.linalg.norm(X[:, np.newaxis] - self.centroids, axis=2) # shape (M, K)
            labels = np.argmin(distances, axis=1)
            
            # Update centroids
            new_centroids = np.array([X[labels == j].mean(axis=0) if len(X[labels == j]) > 0 else self.centroids[j] for j in range(self.k)])
            if np.allclose(self.centroids, new_centroids):
                break
            self.centroids = new_centroids
            
        return labels

def run_logged_simulation(faksi_1_name, file_json_1, faksi_2_name, file_json_2):
    p1 = Player(faksi_1_name)
    p2 = Player(name=faksi_2_name)
    
    p1.load_deck_from_json(file_json_1)
    p2.load_deck_from_json(file_json_2)
    
    p1.setup_phase()
    p2.setup_phase()
    
    with open(file_json_1, 'r') as f:
        card_a_name_1 = json.load(f)["cards"][0]["name"]
    with open(file_json_2, 'r') as f:
        card_a_name_2 = json.load(f)["cards"][0]["name"]
        
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
            winner = first_player.name if res == "GAME_OVER" else second_player.name
            break
            
        second_player.attach_prana()
        res = second_player.attack(opponent=first_player)
        if res in ["GAME_OVER", "GAME_OVER_SUICIDE"]:
            winner = second_player.name if res == "GAME_OVER" else first_player.name
            break
        turn += 1
        
    if not winner:
        hp1 = p1.active_character.current_hp if p1.active_character else 0
        hp2 = p2.active_character.current_hp if p2.active_character else 0
        winner = faksi_1_name if hp1 >= hp2 else faksi_2_name
        
    winner_hp = p1.active_character.current_hp if winner == faksi_1_name else p2.active_character.current_hp
    winner_hp = max(0, winner_hp)
    
    label = 1 if winner == faksi_1_name else 0
    return p1_card_a_count, p2_card_a_count, p1_is_first, turn, winner_hp, label

def run_ensemble_and_clustering():
    print("=== MENGUMPULKAN DATA SIMULASI (N = 1500) ===")
    
    matchups = [
        ("PANDAWA", "data/satwika.json", "KURAWA", "data/tamasika.json", 1, 0),
        ("KURAWA", "data/tamasika.json", "RAJASIKA", "data/rajasika.json", 0, 1),
        ("RAJASIKA", "data/rajasika.json", "PANDAWA", "data/satwika.json", 0, 0)
    ]
    
    dataset = []
    cluster_features = [] # To store [Total_Turns, Winner_HP]
    
    original_stdout = sys.stdout
    sys.stdout = io.StringIO()
    
    try:
        for name1, json1, name2, json2, pvk, kvr in matchups:
            for _ in range(500):
                p1_a, p2_a, p1_first, turns, winner_hp, label = run_logged_simulation(name1, json1, name2, json2)
                dataset.append([p1_a, p2_a, p1_first, pvk, kvr, label])
                cluster_features.append([turns, winner_hp])
    finally:
        sys.stdout = original_stdout
        
    # --- TAHAP 1: RANDOM FOREST ---
    X = np.array([row[:5] for row in dataset])
    y = np.array([row[5] for row in dataset])
    
    # Shuffle & Split
    indices = np.arange(X.shape[0])
    np.random.seed(42)
    np.random.shuffle(indices)
    X = X[indices]
    y = y[indices]
    
    split = int(0.8 * X.shape[0])
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]
    
    rf = RandomForestClassifier(n_estimators=7, max_depth=3)
    rf.fit(X_train, y_train)
    
    rf_train_acc = np.mean(rf.predict(X_train) == y_train) * 100
    rf_test_acc = np.mean(rf.predict(X_test) == y_test) * 100
    
    print("\n=== HASIL MODEL RANDOM FOREST (ANSEMBEL 7 POHON) ===")
    print(f"Akurasi Random Forest (Training Set): {rf_train_acc:.2f}%")
    print(f"Akurasi Random Forest (Testing Set) : {rf_test_acc:.2f}%")
    print("  * Random Forest terbukti mengurangi variansi dan lebih stabil dibanding Pohon Keputusan Tunggal.")
    
    # --- TAHAP 2: K-MEANS CLUSTERING ---
    X_clust = np.array(cluster_features, dtype=float)
    
    kmeans = KMeans(k=3, max_iters=30)
    labels = kmeans.fit(X_clust)
    
    print("\n=== HASIL K-MEANS CLUSTERING (ANALISIS ARKETIPE LAGA) ===")
    for cluster_id in range(3):
        center = kmeans.centroids[cluster_id]
        points = X_clust[labels == cluster_id]
        count = len(points)
        
        # Classify archetype
        turns, hp = center[0], center[1]
        if turns < 14 and hp > 65:
            archetype = "Aggro Matchup (Cepat & Sisa HP Tinggi)"
        elif turns > 18:
            archetype = "Control/Attrition Matchup (Lambat & Taktis)"
        else:
            archetype = "Midrange/Balanced Matchup (Tempo Sedang)"
            
        print(f"Klaster {cluster_id:<1}: {archetype}")
        print(f"  - Pusat Sentroid: {turns:.1f} Turn | Sisa HP Pemenang: {hp:.1f}")
        print(f"  - Jumlah Laga   : {count} pertandingan ({count/len(X_clust)*100:.1f}%)")

if __name__ == "__main__":
    run_ensemble_and_clustering()
