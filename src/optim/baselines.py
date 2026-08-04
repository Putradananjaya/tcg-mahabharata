"""Baseline optimizers to benchmark ga.py / pso.py / nsga2.py / hybrid.py against:
random search, CMA-ES, and Bayesian optimization."""


def run_random_search(pop_size: int, generations: int, num_runs: int):
    raise NotImplementedError


def run_cma_es(generations: int, num_runs: int):
    raise NotImplementedError


def run_bayesian_optimization(num_iterations: int, num_runs: int):
    raise NotImplementedError
