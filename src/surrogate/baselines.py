"""Mandatory baselines for surrogate validation (Fase 6 review: "MAE 0.024
tanpa baseline & tanpa protokol" -- a surrogate's accuracy number means
nothing without a baseline it needs to beat). Three baselines, increasing
in sophistication:

  (a) ConstantPredictor  -- predicts w_hat=50.0 (i.e. 50% win rate) for
      every input, ignoring Theta entirely. If the MLP does not beat this
      by a statistically meaningful margin, it has learned nothing useful
      about the design-parameter -> win-rate mapping.
  (b) LinearRegressionBaseline -- ordinary least squares, closed-form via
      numpy (no scipy/sklearn in this venv -- see rules_spec.md's
      recurring note on that constraint, e.g. nash_averaging.py).
  (c) GradientBoostingBaseline -- a from-scratch CART regression tree +
      gradient boosting ensemble (again, no sklearn available). One
      independent booster per output dimension.

All three share the same fit(X, y) / predict(X) interface as
src.surrogate.mlp.MLPSurrogate and src.surrogate.ensemble.MLPEnsemble
(X: (n, input_dim), y/predict return: (n, output_dim)), so
experiments/exp06_surrogate_validation.py can loop over a list of models
uniformly.
"""
from __future__ import annotations

import numpy as np


class ConstantPredictor:
    """w_hat = 50.0 for every output, every input. See module docstring."""

    def __init__(self, value: float = 50.0):
        self.value = value
        self.output_dim = None

    def fit(self, X: np.ndarray, y: np.ndarray) -> "ConstantPredictor":
        self.output_dim = 1 if y.ndim == 1 else y.shape[1]
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        n = X.shape[0]
        if self.output_dim == 1:
            return np.full(n, self.value)
        return np.full((n, self.output_dim), self.value)


class LinearRegressionBaseline:
    """Ordinary least squares with an intercept, closed-form via
    np.linalg.lstsq. Natively multi-output (Y can be (n, output_dim))."""

    def __init__(self):
        self.coef_ = None  # (input_dim + 1, output_dim), last row = intercept

    def fit(self, X: np.ndarray, y: np.ndarray) -> "LinearRegressionBaseline":
        X_design = np.hstack([X, np.ones((X.shape[0], 1))])
        coef, _residuals, _rank, _sv = np.linalg.lstsq(X_design, y, rcond=None)
        self.coef_ = coef
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        X_design = np.hstack([X, np.ones((X.shape[0], 1))])
        return X_design @ self.coef_


class _TreeNode:
    __slots__ = ("is_leaf", "value", "feature", "threshold", "left", "right")

    def __init__(self):
        self.is_leaf = True
        self.value = 0.0
        self.feature = None
        self.threshold = None
        self.left = None
        self.right = None


class _RegressionTree:
    """Minimal CART regression tree (greedy variance-reduction splits).
    Single-output only -- GradientBoostingBaseline below fits one of these
    per output dimension per boosting round."""

    def __init__(self, max_depth: int = 3, min_samples_split: int = 6):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.root = None

    def fit(self, X: np.ndarray, y: np.ndarray) -> "_RegressionTree":
        self.root = self._build(X, y, depth=0)
        return self

    def _build(self, X: np.ndarray, y: np.ndarray, depth: int) -> _TreeNode:
        node = _TreeNode()
        node.value = float(y.mean()) if len(y) else 0.0
        if depth >= self.max_depth or len(y) < self.min_samples_split or np.all(y == y[0]):
            return node

        best = self._best_split(X, y)
        if best is None:
            return node

        feature, threshold, left_mask = best
        node.is_leaf = False
        node.feature = feature
        node.threshold = threshold
        node.left = self._build(X[left_mask], y[left_mask], depth + 1)
        node.right = self._build(X[~left_mask], y[~left_mask], depth + 1)
        return node

    @staticmethod
    def _best_split(X: np.ndarray, y: np.ndarray):
        n, num_features = X.shape
        parent_sse = float(np.sum((y - y.mean()) ** 2))
        best_gain = 1e-12  # require a strictly positive reduction
        best = None
        for feature in range(num_features):
            col = X[:, feature]
            order = np.argsort(col)
            col_sorted = col[order]
            y_sorted = y[order]
            # candidate thresholds: midpoints between distinct consecutive values
            distinct = np.where(np.diff(col_sorted) > 1e-12)[0]
            for i in distinct:
                left_y, right_y = y_sorted[: i + 1], y_sorted[i + 1 :]
                if len(left_y) < 1 or len(right_y) < 1:
                    continue
                sse = float(np.sum((left_y - left_y.mean()) ** 2) + np.sum((right_y - right_y.mean()) ** 2))
                gain = parent_sse - sse
                if gain > best_gain:
                    threshold = (col_sorted[i] + col_sorted[i + 1]) / 2.0
                    best_gain = gain
                    best = (feature, threshold, col <= threshold)
        return best

    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.array([self._predict_one(row, self.root) for row in X])

    def _predict_one(self, row, node: _TreeNode) -> float:
        while not node.is_leaf:
            node = node.left if row[node.feature] <= node.threshold else node.right
        return node.value


class GradientBoostingBaseline:
    """Gradient boosting on squared-error loss (i.e. each round fits a tree
    to the current residual, standard for L2 loss where the negative
    gradient IS the residual). One independent booster per output
    dimension. From scratch -- no sklearn/xgboost/lightgbm in this venv."""

    def __init__(self, n_estimators: int = 60, learning_rate: float = 0.1, max_depth: int = 3):
        self.n_estimators = n_estimators
        self.learning_rate = learning_rate
        self.max_depth = max_depth
        self._init_values = None  # (output_dim,)
        self._trees = None  # list[output_dim] of list[n_estimators] of _RegressionTree

    def fit(self, X: np.ndarray, y: np.ndarray) -> "GradientBoostingBaseline":
        y2 = y.reshape(-1, 1) if y.ndim == 1 else y
        output_dim = y2.shape[1]
        self._init_values = y2.mean(axis=0)
        self._trees = []
        for d in range(output_dim):
            trees_d = []
            residual = y2[:, d] - self._init_values[d]
            for _ in range(self.n_estimators):
                tree = _RegressionTree(max_depth=self.max_depth).fit(X, residual)
                pred = tree.predict(X)
                residual = residual - self.learning_rate * pred
                trees_d.append(tree)
            self._trees.append(trees_d)
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        output_dim = len(self._init_values)
        out = np.zeros((X.shape[0], output_dim))
        for d in range(output_dim):
            pred = np.full(X.shape[0], self._init_values[d])
            for tree in self._trees[d]:
                pred = pred + self.learning_rate * tree.predict(X)
            out[:, d] = pred
        if output_dim == 1:
            return out[:, 0]
        return out
