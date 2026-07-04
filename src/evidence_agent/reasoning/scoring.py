from __future__ import annotations

from evidence_agent.reasoning.chains import Chain, ChainView
from evidence_agent.reasoning.hypothesis import HypothesisNode


def score_confidence(
    node: HypothesisNode, chain_views: dict[Chain, ChainView]
) -> float:
    """Pure confidence in [0, 1]: artefact balance minus unknown/weakness penalty."""
    support = len(node.supporting_artefacts)
    contrary = len(node.contrary_artefacts)
    total = support + contrary
    base = support / total if total else 0.0
    weakness_count = sum(len(v.weaknesses) for v in chain_views.values())
    penalty = 0.05 * len(node.unknowns) + 0.05 * weakness_count
    return round(max(0.0, min(1.0, base - penalty)), 4)


def dependency_risk(node: HypothesisNode, support_map: dict[str, float]) -> dict:
    """Identify the artefact whose removal most reduces support.

    `support_map` maps artefact id -> support weight. Returns the critical
    artefact and the fraction of total support lost if it is excluded. Ties
    break on the smallest artefact id for determinism.
    """
    if not support_map:
        return {"critical_artefact": None, "drop": 0.0}
    total = sum(support_map.values())
    critical = max(sorted(support_map), key=lambda k: support_map[k])
    drop = support_map[critical] / total if total else 0.0
    return {"critical_artefact": critical, "drop": round(drop, 4)}
