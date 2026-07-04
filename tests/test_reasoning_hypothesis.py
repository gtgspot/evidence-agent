import pytest
from evidence_agent.reasoning.schema import init_reasoning_schema
from evidence_agent.reasoning.hypothesis import (
    HypothesisNode, add_node, get_node, list_nodes,
)


@pytest.fixture
def rconn(conn):
    init_reasoning_schema(conn)
    return conn


def test_add_and_get_roundtrip(rconn):
    node = add_node(
        rconn, "M1",
        claim="the search was warrantless and unlawful",
        required_legal_elements=["lawful search", "possession"],
        supporting_artefacts=["ART-0001", "ART-0002"],
        contrary_artefacts=["ART-0003"],
        unknowns=["was consent given?"],
        next_test="obtain the running sheet",
    )
    assert node.id.startswith("HYP-")
    assert node.required_legal_elements == ["lawful search", "possession"]
    assert node.supporting_artefacts == ["ART-0001", "ART-0002"]
    got = get_node(rconn, node.id)
    assert got == node
    assert isinstance(got, HypothesisNode)


def test_list_nodes_by_matter(rconn):
    add_node(rconn, "M1", "a", ["e"], [], [], [], "")
    add_node(rconn, "M1", "b", ["e"], [], [], [], "")
    add_node(rconn, "M2", "c", ["e"], [], [], [], "")
    assert len(list_nodes(rconn, "M1")) == 2
    assert len(list_nodes(rconn, "M2")) == 1


def test_missing_node_returns_none(rconn):
    assert get_node(rconn, "HYP-9999") is None
