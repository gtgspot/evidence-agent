import pytest
from evidence_agent.core import ArtefactClass, add_artefact, add_anchor
from evidence_agent.governance.schema import init_governance_schema
from evidence_agent.governance.linkcheck import Claim, check_claim_anchoring


@pytest.fixture
def gconn(conn):
    init_governance_schema(conn)
    return conn


def _original(gconn, tmp_path, matter, name, data=b"x"):
    p = tmp_path / name
    p.write_bytes(data)
    return add_artefact(gconn, matter, ArtefactClass.ORIGINAL, "s", p)


def _analysis(gconn, tmp_path, parent, name):
    p = tmp_path / name
    p.write_bytes(b"analysis")
    return add_artefact(
        gconn, "M1", ArtefactClass.ANALYSIS, "s", p, parent_id=parent.id
    )


def test_fully_anchored_returns_empty(gconn, tmp_path):
    orig = _original(gconn, tmp_path, "M1", "o")
    analysis = _analysis(gconn, tmp_path, orig, "an")
    anc = add_anchor(gconn, "M1", orig.id, "doc", "p12/l4-9", "warrantless search")
    claims = [Claim("The search was warrantless", [anc.id])]
    assert check_claim_anchoring(gconn, analysis.id, claims) == []


def test_unanchored_claims_are_returned(gconn, tmp_path):
    orig = _original(gconn, tmp_path, "M1", "o")
    analysis = _analysis(gconn, tmp_path, orig, "an")
    good = add_anchor(gconn, "M1", orig.id, "doc", "p1", "ok")
    foreign_orig = _original(gconn, tmp_path, "M2", "o2")
    foreign = add_anchor(gconn, "M2", foreign_orig.id, "doc", "p1", "other matter")

    no_anchor = Claim("bare assertion", [])
    missing = Claim("cites a ghost anchor", ["ANC-9999"])
    cross_matter = Claim("cites another matter", [foreign.id])
    ok = Claim("properly anchored", [good.id])

    result = check_claim_anchoring(
        gconn, analysis.id, [no_anchor, missing, cross_matter, ok]
    )
    assert result == [no_anchor, missing, cross_matter]
