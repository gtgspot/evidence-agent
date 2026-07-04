import pytest
from evidence_agent.core import ArtefactClass, add_artefact, add_anchor
from evidence_agent.reasoning.schema import init_reasoning_schema
from evidence_agent.reasoning.hypothesis import add_node
from evidence_agent.reasoning.matrix import build_matrix


@pytest.fixture
def rconn(conn):
    init_reasoning_schema(conn)
    return conn


def test_matrix_row_per_element_with_anchor_lowers_risk(rconn, tmp_path):
    p = tmp_path / "brief.pdf"
    p.write_bytes(b"hello")
    art = add_artefact(rconn, "M1", ArtefactClass.ORIGINAL, "police brief", p)
    add_anchor(rconn, "M1", art.id, "doc", "p12/l4-9", "the search was warrantless")
    node = add_node(
        rconn, "M1", "warrantless search",
        required_legal_elements=["lawful search", "possession"],
        supporting_artefacts=[art.id],
        contrary_artefacts=["ART-9999"],
        unknowns=[], next_test="",
    )
    rows = build_matrix(rconn, node)
    assert [r["element"] for r in rows] == ["lawful search", "possession"]
    assert set(rows[0]) == {
        "element", "evidence", "admissibility_risk", "contradiction", "hearing_utility",
    }
    assert rows[0]["evidence"] == [art.id]
    assert rows[0]["admissibility_risk"] == "low"        # anchored
    assert rows[0]["contradiction"] == ["ART-9999"]
    assert rows[0]["hearing_utility"] == "contested"     # contrary present


def test_matrix_unanchored_high_risk(rconn):
    node = add_node(
        rconn, "M1", "possession",
        required_legal_elements=["possession"],
        supporting_artefacts=["ART-1234"],   # no anchor -> list_anchors == []
        contrary_artefacts=[],
        unknowns=[], next_test="",
    )
    row = build_matrix(rconn, node)[0]
    assert row["admissibility_risk"] == "high"
    assert row["hearing_utility"] == "high"
