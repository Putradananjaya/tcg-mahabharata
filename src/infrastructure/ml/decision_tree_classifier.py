import numpy as np

class Node:
    def __init__(self, feature_idx=None, threshold=None, left=None, right=None, *, value=None):
        self.feature_idx = feature_idx
        self.threshold = threshold
        self.left = left
        self.right = right
        self.value = value

    def is_leaf(self):
        return self.value is not None

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

    def predict(self, X):
        return np.array([1 if p >= 0.5 else 0 for p in self.predict_proba(X)])

class RandomForestClassifier:
    def __init__(self, n_estimators=5, max_depth=3):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.trees = []

    def fit(self, X, y):
        m = X.shape[0]
        self.trees = []
        for _ in range(self.n_estimators):
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
