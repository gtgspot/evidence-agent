"""Dynamic reasoning agents — hypothesis nodes, parallel chains, scoring, matrices."""
from evidence_agent.reasoning.schema import init_reasoning_schema
from evidence_agent.reasoning.hypothesis import (
    HypothesisNode, add_node, get_node, list_nodes,
)
from evidence_agent.reasoning.chains import (
    Chain, ChainView, Analyst, run_chains, persist_chain_views,
)
from evidence_agent.reasoning.scoring import score_confidence, dependency_risk
from evidence_agent.reasoning.decisionlog import record_decision, list_decisions
from evidence_agent.reasoning.matrix import build_matrix
from evidence_agent.reasoning.engine import run_reasoning

__all__ = [
    "init_reasoning_schema",
    "HypothesisNode", "add_node", "get_node", "list_nodes",
    "Chain", "ChainView", "Analyst", "run_chains", "persist_chain_views",
    "score_confidence", "dependency_risk",
    "record_decision", "list_decisions",
    "build_matrix", "run_reasoning",
]
