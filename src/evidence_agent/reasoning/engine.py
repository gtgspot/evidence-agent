from __future__ import annotations

import sqlite3
from collections import defaultdict

from evidence_agent.reasoning.chains import Analyst, run_chains, persist_chain_views
from evidence_agent.reasoning.hypothesis import HypothesisNode
from evidence_agent.reasoning.matrix import build_matrix
from evidence_agent.reasoning.scoring import dependency_risk, score_confidence


def _support_map_from_views(chain_views) -> dict[str, float]:
    """Tally how many chains relied on each artefact -> its support weight."""
    tally: dict[str, float] = defaultdict(float)
    for view in chain_views.values():
        for aid in view.relied_on:
            tally[aid] += 1.0
    return dict(tally)


def run_reasoning(
    conn: sqlite3.Connection, node: HypothesisNode, analyst: Analyst
) -> dict:
    """Orchestrate: parallel chains -> scoring -> persistence -> matrix."""
    chain_views = run_chains(node, analyst)
    persist_chain_views(conn, node.id, chain_views)
    confidence = score_confidence(node, chain_views)
    support_map = _support_map_from_views(chain_views)
    risk = dependency_risk(node, support_map)
    matrix = build_matrix(conn, node)
    return {
        "node_id": node.id,
        "chain_views": chain_views,
        "confidence": confidence,
        "dependency_risk": risk,
        "matrix": matrix,
    }
