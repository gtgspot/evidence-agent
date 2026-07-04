from __future__ import annotations

import sqlite3

from evidence_agent.core import list_anchors
from evidence_agent.reasoning.hypothesis import HypothesisNode


def build_matrix(conn: sqlite3.Connection, node: HypothesisNode) -> list[dict]:
    """One row per required legal element:
    element -> evidence -> admissibility_risk -> contradiction -> hearing_utility."""
    evidence = list(node.supporting_artefacts)
    contradiction = list(node.contrary_artefacts)
    anchored = any(list_anchors(conn, aid) for aid in evidence)
    admissibility_risk = "low" if anchored else "high"
    if not evidence:
        hearing_utility = "low"
    elif contradiction:
        hearing_utility = "contested"
    else:
        hearing_utility = "high"
    return [
        {
            "element": element,
            "evidence": evidence,
            "admissibility_risk": admissibility_risk,
            "contradiction": contradiction,
            "hearing_utility": hearing_utility,
        }
        for element in node.required_legal_elements
    ]
