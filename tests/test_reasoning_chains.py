import pytest
from evidence_agent.reasoning.schema import init_reasoning_schema
from evidence_agent.reasoning.hypothesis import add_node
from evidence_agent.reasoning.chains import (
    Chain, ChainView, run_chains, persist_chain_views,
)


@pytest.fixture
def rconn(conn):
    init_reasoning_schema(conn)
    return conn


def fake_analyst(chain: Chain, node) -> ChainView:
    """Deterministic stand-in for the production LLM-backed analyst."""
    positions = {
        Chain.PROSECUTION: "every element is made out",
        Chain.DEFENCE: "the search was unlawful; exclude the tender",
        Chain.NEUTRAL: "outcome turns on the lawfulness of the search",
    }
    return ChainView(
        chain=chain,
        position=positions[chain],
        relied_on=list(node.supporting_artefacts),
        weaknesses=["chain of custody gap"] if chain is Chain.DEFENCE else [],
    )


def _node(rconn):
    return add_node(
        rconn, "M1", "warrantless search", ["lawful search"],
        ["ART-0001", "ART-0002"], ["ART-0003"], [], "get running sheet",
    )


def test_run_chains_returns_all_three(rconn):
    node = _node(rconn)
    views = run_chains(node, fake_analyst)
    assert set(views) == {Chain.PROSECUTION, Chain.DEFENCE, Chain.NEUTRAL}
    assert views[Chain.DEFENCE].weaknesses == ["chain of custody gap"]
    assert views[Chain.PROSECUTION].relied_on == ["ART-0001", "ART-0002"]


def test_persist_chain_views_roundtrip(rconn):
    node = _node(rconn)
    views = run_chains(node, fake_analyst)
    persist_chain_views(rconn, node.id, views)
    rows = rconn.execute(
        "SELECT chain, position FROM chain_views WHERE node_id = ? ORDER BY chain",
        (node.id,),
    ).fetchall()
    assert [r["chain"] for r in rows] == ["defence", "neutral", "prosecution"]
