"""Smoke test: every module in the reorganized src/ tree must at least import
cleanly. This does not test behavior, only that the migration to the
research-suite layout didn't break module paths."""

import importlib

import pytest

MODULES = [
    "src.domain.models",
    "src.domain.card_repository",
    "src.simulator.engine",
    "src.simulator.fitness",
    "src.simulator.determinism",
    "src.simulator.agent_env",
    "src.agents.base",
    "src.agents.random_agent",
    "src.agents.greedy_agent",
    "src.agents.scripted_agents",
    "src.agents.mcts_agent",
    "src.agents.dqn_agent",
    "src.metrics.winrate",
    "src.metrics.payoff_matrix",
    "src.metrics.nash_averaging",
    "src.metrics.elo",
    "src.metrics.restricted_play",
    "src.metrics.diversity",
    "src.metrics.balance_objective",
    "src.metrics.power_creep",
    "src.metrics.nonparametric",
    "src.surrogate.mlp",
    "src.surrogate.baselines",
    "src.surrogate.ensemble",
    "src.surrogate.model_management",
    "src.optim.ga",
    "src.optim.pso",
    "src.optim.nsga2",
    "src.optim.hybrid",
    "src.optim.baselines",
    "src.optim.objective",
    "src.sensitivity.sobol",
    "src.sensitivity.morris",
    "src.agents_llm.card_designer",
    "src.meta_balancer.anomaly",
    "src.infrastructure.analysis.academic_tests",
    "src.infrastructure.ml.decision_tree_classifier",
    "src.api.server",
]


@pytest.mark.parametrize("module_name", MODULES)
def test_module_imports(module_name):
    importlib.import_module(module_name)
