import pytest
from evidence_agent.reasoning.schema import init_reasoning_schema
from evidence_agent.reasoning.hypothesis import add_node
from evidence_agent.reasoning.chains import Chain, ChainView
from evidence_agent.reasoning.engine import run_reasoning


@pytest.fixture
def rconn(conn):
    init_reasoning_schema(conn)
    return conn


def fake_analyst(chain: Chain, node) -> ChainView:
    """Deterministic fake — NO network, NO LLM. Prosecution & neutral rely on
    ART-0001; only prosecution also relies on ART-0002 (making ART-0001 critical)."""
    relied = {
        Chain.PROSECUTION: ["ART-0001", "ART-0002"],
        Chain.DEFENCE: [],
        Chain.NEUTRAL: ["ART-0001"],
    }
    return ChainView(
        chain=chain, position=f"{chain.value} view",
        relied_on=relied[chain],
        weaknesses=["gap"] if chain is Chain.DEFENCE else [],
    )


def test_run_reasoning_end_to_end(rconn):
    node = add_node(
        rconn, "M1", "warrantless search", ["lawful search"],
        supporting_artefacts=["ART-0001", "ART-0002"],
        contrary_artefacts=[], unknowns=[], next_test="",
    )
    result = run_reasoning(rconn, node, fake_analyst)

    # 3 chains ran and persisted
    assert set(result["chain_views"]) == {Chain.PROSECUTION, Chain.DEFENCE, Chain.NEUTRAL}
    assert rconn.execute(
        "SELECT COUNT(*) FROM chain_views WHERE node_id = ?", (node.id,)
    ).fetchone()[0] == 3

    # confidence: base 2/2=1.0 minus one defence weakness (0.05)
    assert result["confidence"] == 0.95

    # dependency risk built from relied_on tallies: ART-0001 relied on by 2 chains,
    # ART-0002 by 1 -> ART-0001 critical, drop 2/3
    assert result["dependency_risk"]["critical_artefact"] == "ART-0001"
    assert result["dependency_risk"]["drop"] == 0.6667

    # matrix present, keyed by element
    assert result["matrix"][0]["element"] == "lawful search"
