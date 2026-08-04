"""Surrogate-assisted evolutionary optimization with proper model management
(Jin, "Surrogate-assisted evolutionary computation: Recent advances and
future challenges", Swarm and Evolutionary Computation, 2011).

Fase 6 review: the previous GA-on-surrogate pipeline (src/surrogate/mlp.py
run_surrogate_training, Tahap 3) trained one surrogate once, then ran 100
GA generations purely against its frozen point predictions with no
uncertainty, no re-validation against the real simulator during the run,
and only checked the real simulator once, at the very end. That is exactly
the failure mode Jin's survey warns about: an EA will happily exploit
whatever the surrogate gets wrong (a "false optimum"), and without any
in-the-loop correction there is nothing to stop it. This module implements
Jin's "generation-based evolution control" pattern instead:

  1. The optimizer (src.optim.ga's crossover/mutate, reused rather than
     duplicated) proposes candidates.
  2. The surrogate (an src.surrogate.ensemble.MLPEnsemble) predicts mu and
     sigma_hat for each candidate; candidates are RANKED by an
     uncertainty-aware acquisition function (expected_improvement or
     lower_confidence_bound below), never by the naked point prediction
     alone (Fase 6 task 4).
  3. Every `validate_every` generations, the top-`top_m` acquisition-ranked
     elites are re-evaluated on the REAL simulator (src.simulator.fitness.
     evaluate_chromosome).
  4. Those real results are appended to the training set and the ensemble
     is retrained from scratch on the growing dataset (online retraining --
     full retrain, not incremental fine-tuning; justified by how cheap this
     simulator is to query, see rules_spec.md section 13).
  5. The surrogate-vs-truth gap at each validation checkpoint is recorded
     in `history`, the source of the "surrogate error vs generation" figure
     experiments/exp06_surrogate_assisted_ea.py produces.

The function's return value's `final_verified_rates`/`final_verified_loss`
come from a final high-N REAL simulator run on the best TRUE-evaluated
candidate found -- never from the surrogate -- see run_surrogate_assisted_ea's
docstring and Fase 6 acceptance criteria.
"""
from __future__ import annotations

import copy
import random
from statistics import NormalDist

import numpy as np

_STANDARD_NORMAL = NormalDist(0.0, 1.0)


def expected_improvement(mu: float, sigma: float, f_best: float, xi: float = 1.0) -> float:
    """Expected Improvement for MINIMIZATION (lower loss is better).
    f_best: best TRUE (real-simulator) loss observed so far -- not a
    surrogate prediction, by design (see module docstring point 3).
    xi: small positive exploration margin (in loss units); higher xi biases
    the search toward more-uncertain regions rather than pure exploitation.
    Returns a NON-NEGATIVE score; higher is better (more improvement expected).
    """
    if sigma <= 1e-9:
        return max(f_best - mu - xi, 0.0)
    z = (f_best - mu - xi) / sigma
    return (f_best - mu - xi) * _STANDARD_NORMAL.cdf(z) + sigma * _STANDARD_NORMAL.pdf(z)


def lower_confidence_bound(mu: float, sigma: float, kappa: float = 1.0) -> float:
    """LCB for MINIMIZATION: mu - kappa*sigma. LOWER is better (a candidate
    can win either by a low predicted loss or by high uncertainty --
    exploration). kappa trades exploration (higher) for exploitation (lower)."""
    return mu - kappa * sigma


def _scalar_loss_stats(ensemble, x_norm: np.ndarray):
    """For each row of x_norm, compute EVERY ensemble member's own scalar
    loss (sum of squared deviation from the 50% target across the 3
    matchup outputs -- the same quantity src.simulator.fitness.evaluate_chromosome
    returns), then the mean and std of that scalar ACROSS members. This is
    deliberately not "propagate per-output sigma through the nonlinear
    loss formula" -- taking ensemble disagreement on the already-scalarized
    loss is simpler and avoids an unnecessary Gaussian-propagation
    approximation of a quadratic transform.
    Returns (mu_loss, sigma_loss), each shape (n,).
    """
    member_preds = ensemble.predict_all(x_norm)  # (num_models, n, output_dim)
    member_losses = np.sum((member_preds - 50.0) ** 2, axis=2)  # (num_models, n)
    return member_losses.mean(axis=0), member_losses.std(axis=0)


def select_infill_points(candidates, ensemble, featurize, uncertainty_threshold: float):
    """Return the subset of `candidates` (list of chromosome dicts) whose
    ensemble-disagreement scalar-loss uncertainty (sigma_hat, see
    _scalar_loss_stats) exceeds `uncertainty_threshold`. `featurize(chromo)`
    must return that candidate's normalized feature vector."""
    if not candidates:
        return []
    X = np.array([featurize(c) for c in candidates])
    _, sigma = _scalar_loss_stats(ensemble, X)
    return [c for c, s in zip(candidates, sigma) if s > uncertainty_threshold]


def retrain_with_infill(ensemble_factory, dataset_X_dicts, dataset_y, new_points,
                         evaluate_fn, featurize_fn, num_runs: int,
                         ensemble_epochs: int = 1200, ensemble_lr: float = 0.03, seed: int = 0):
    """Evaluate `new_points` (chromosome dicts) on the REAL simulator via
    `evaluate_fn` (src.simulator.fitness.evaluate_chromosome-shaped: returns
    (loss, rates_dict)), append to (dataset_X_dicts, dataset_y) IN PLACE,
    retrain a fresh ensemble (from `ensemble_factory()`, an MLPEnsemble
    with no `.fit` called yet) on the full updated dataset, and return
    (ensemble, X_mean, X_std, true_losses_of_new_points)."""
    true_losses = []
    for chromo in new_points:
        loss, rates = evaluate_fn(chromo)
        true_losses.append(loss)
        dataset_X_dicts.append(chromo)
        dataset_y.append([rates["SATWIKA_vs_TAMASIKA"], rates["TAMASIKA_vs_RAJASIKA"], rates["RAJASIKA_vs_SATWIKA"]])

    X = np.array([featurize_fn(d) for d in dataset_X_dicts])
    X_mean, X_std = X.mean(axis=0), X.std(axis=0)
    X_std = np.where(X_std == 0, 1.0, X_std)
    X_norm = (X - X_mean) / X_std
    y = np.array(dataset_y)

    ensemble = ensemble_factory()
    ensemble.fit(X_norm, y, epochs=ensemble_epochs, learning_rate=ensemble_lr, seed=seed)
    return ensemble, X_mean, X_std, true_losses


def run_surrogate_assisted_ea(
    pop_size: int = 24,
    generations: int = 40,
    validate_every: int = 5,
    top_m: int = 4,
    num_seed_points: int = 40,
    num_runs_seed: int = 100,
    num_runs_real: int = 100,
    num_runs_final: int = 2000,
    acquisition: str = "ei",
    xi: float = 1.0,
    kappa: float = 1.0,
    ensemble_size: int = 5,
    ensemble_epochs: int = 1200,
    ensemble_lr: float = 0.03,
    seed: int = 0,
    verbose: bool = True,
):
    """The full loop described in the module docstring. Returns a dict with
    `best_chromo`, `final_verified_rates`/`final_verified_loss` (from a
    REAL num_runs_final-game simulator run -- see acceptance criteria in
    rules_spec.md section 13: the final claim is never a surrogate
    prediction), `history` (per-generation log used for the
    "surrogate error vs generation" figure), and `num_real_evaluations`
    (total real-simulator design points spent, seed + all infill)."""
    from src.optim.ga import crossover, generate_random_chromosome, mutate
    from src.simulator.fitness import SMART_START, evaluate_chromosome
    from src.surrogate.ensemble import MLPEnsemble
    from src.surrogate.mlp import dict_to_array

    py_rng = random.Random(seed)
    np_seed_counter = [seed]

    def next_np_seed():
        np_seed_counter[0] += 1
        return np_seed_counter[0]

    def loss_from_rates(rates_vec):
        return sum((v - 50.0) ** 2 for v in rates_vec)

    def ensemble_factory():
        return MLPEnsemble(num_models=ensemble_size, seed=next_np_seed(), input_dim=25, hidden_dim=16, output_dim=3)

    # --- 1. seed dataset: real-simulator evaluations, no surrogate involved yet ---
    dataset_X_dicts = [SMART_START.copy()]
    dataset_y = []
    for _ in range(num_seed_points - 1):
        dataset_X_dicts.append(generate_random_chromosome())

    for chromo in dataset_X_dicts:
        loss, rates = evaluate_chromosome(chromo, num_runs=num_runs_seed)
        dataset_y.append([rates["SATWIKA_vs_TAMASIKA"], rates["TAMASIKA_vs_RAJASIKA"], rates["RAJASIKA_vs_SATWIKA"]])

    seed_losses = [loss_from_rates(y) for y in dataset_y]
    best_idx = int(np.argmin(seed_losses))
    f_best = seed_losses[best_idx]
    best_chromo = copy.deepcopy(dataset_X_dicts[best_idx])

    ensemble, X_mean, X_std, _ = retrain_with_infill(
        ensemble_factory, dataset_X_dicts, dataset_y, [], evaluate_chromosome,
        dict_to_array, num_runs_seed, ensemble_epochs, ensemble_lr, next_np_seed(),
    )
    # retrain_with_infill with new_points=[] just fits on the seed set already collected.

    def featurize(chromo):
        return (dict_to_array(chromo) - X_mean) / X_std

    population = [generate_random_chromosome() for _ in range(pop_size)]
    population[0] = copy.deepcopy(best_chromo)

    history = []

    for gen in range(generations):
        X_pop_norm = np.array([featurize(c) for c in population])
        mu_loss, sigma_loss = _scalar_loss_stats(ensemble, X_pop_norm)

        if acquisition == "ei":
            acq = np.array([-expected_improvement(mu_loss[i], sigma_loss[i], f_best, xi=xi) for i in range(len(population))])
        elif acquisition == "lcb":
            acq = np.array([lower_confidence_bound(mu_loss[i], sigma_loss[i], kappa=kappa) for i in range(len(population))])
        else:
            raise ValueError(f"unknown acquisition: {acquisition!r}")

        order = np.argsort(acq)
        ranked_population = [population[i] for i in order]
        ranked_mu = mu_loss[order]

        gen_log = {
            "gen": gen,
            "surrogate_best_mu_loss": float(ranked_mu[0]),
            "surrogate_best_sigma_loss": float(sigma_loss[order][0]),
            "f_best_true_so_far": float(f_best),
            "validated": False,
        }

        do_validate = (gen % validate_every == 0) or (gen == generations - 1)
        if do_validate:
            elites = ranked_population[:top_m]
            elite_mu = ranked_mu[:top_m].tolist()
            ensemble, X_mean, X_std, true_losses = retrain_with_infill(
                ensemble_factory, dataset_X_dicts, dataset_y, elites, evaluate_chromosome,
                dict_to_array, num_runs_real, ensemble_epochs, ensemble_lr, next_np_seed(),
            )
            # `featurize` (defined once, above the loop) closes over X_mean/X_std
            # by reference, so it automatically picks up the reassignment above --
            # no need to redefine it here.

            for chromo, loss in zip(elites, true_losses):
                if loss < f_best:
                    f_best = loss
                    best_chromo = copy.deepcopy(chromo)

            gap = float(np.mean(np.abs(np.array(true_losses) - np.array(elite_mu))))
            gen_log.update({
                "validated": True,
                "elite_true_losses": true_losses,
                "elite_surrogate_mu_losses": elite_mu,
                "surrogate_truth_gap_mean_abs": gap,
                "f_best_true_so_far": float(f_best),
                "dataset_size": len(dataset_X_dicts),
            })
            if verbose:
                print(f"  gen {gen:3d}  f_best_true={f_best:8.2f}  gap={gap:7.2f}  "
                      f"dataset_size={len(dataset_X_dicts)}")

        history.append(gen_log)

        new_pop = [copy.deepcopy(ranked_population[0]), copy.deepcopy(ranked_population[1])]
        pool = ranked_population[: max(6, top_m + 2)]
        while len(new_pop) < pop_size:
            p1 = py_rng.choice(pool)
            p2 = py_rng.choice(pool)
            c1, c2 = crossover(p1, p2)
            new_pop.append(mutate(c1))
            if len(new_pop) < pop_size:
                new_pop.append(mutate(c2))
        population = new_pop

    # --- Final claim: REAL simulator verification of the best TRUE-evaluated
    # candidate found across the whole run -- never the surrogate's opinion.
    final_loss, final_rates = evaluate_chromosome(best_chromo, num_runs=num_runs_final)

    return {
        "best_chromo": best_chromo,
        "final_verified_loss": final_loss,
        "final_verified_rates": final_rates,
        "final_verified_num_runs": num_runs_final,
        "history": history,
        "num_real_evaluations": len(dataset_X_dicts),
    }
