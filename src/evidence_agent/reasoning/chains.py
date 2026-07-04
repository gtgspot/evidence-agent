from __future__ import annotations

import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from enum import Enum
from typing import Callable

from evidence_agent.core import new_id
from evidence_agent.reasoning.hypothesis import HypothesisNode


class Chain(Enum):
    PROSECUTION = "prosecution"
    DEFENCE = "defence"
    NEUTRAL = "neutral"


@dataclass(frozen=True)
class ChainView:
    chain: Chain
    position: str
    relied_on: list
    weaknesses: list


# Injected callable signature. Tests pass a deterministic fake; the default
# production analyst may wrap a bridge provider (e.g. providers.anthropic_client).
Analyst = Callable[[Chain, HypothesisNode], ChainView]


def run_chains(node: HypothesisNode, analyst: Analyst) -> dict[Chain, ChainView]:
    """Run the three chains IN PARALLEL over one node via the injected analyst."""
    chains = [Chain.PROSECUTION, Chain.DEFENCE, Chain.NEUTRAL]
    with ThreadPoolExecutor(max_workers=3) as ex:
        results = ex.map(lambda ch: analyst(ch, node), chains)
    return {ch: view for ch, view in zip(chains, results)}


def persist_chain_views(
    conn: sqlite3.Connection, node_id: str, views: dict[Chain, ChainView]
) -> None:
    for chain, view in views.items():
        conn.execute(
            "INSERT INTO chain_views(id, node_id, chain, position, relied_on, weaknesses) "
            "VALUES(?,?,?,?,?,?)",
            (
                new_id(conn, "CV"), node_id, chain.value, view.position,
                json.dumps(view.relied_on), json.dumps(view.weaknesses),
            ),
        )
    conn.commit()
