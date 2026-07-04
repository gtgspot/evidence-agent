from evidence_agent.reasoning.hypothesis import HypothesisNode
from evidence_agent.reasoning.chains import Chain, ChainView
from evidence_agent.reasoning.scoring import score_confidence, dependency_risk


def _node(supporting, contrary, unknowns):
    return HypothesisNode(
        id="HYP-0001", matter_id="M1", claim="c",
        required_legal_elements=["e"],
        supporting_artefacts=supporting,
        contrary_artefacts=contrary,
        unknowns=unknowns,
        next_test="",
    )


def _view(chain, weaknesses):
    return ChainView(chain=chain, position="p", relied_on=[], weaknesses=weaknesses)


def test_score_confidence_pure_formula():
    node = _node(["A", "B", "C"], ["D"], [])          # base = 3/4 = 0.75
    views = {
        Chain.PROSECUTION: _view(Chain.PROSECUTION, []),
        Chain.DEFENCE: _view(Chain.DEFENCE, ["w1"]),   # 1 weakness -> -0.05
        Chain.NEUTRAL: _view(Chain.NEUTRAL, []),
    }
    assert score_confidence(node, views) == 0.70


def test_score_confidence_clamped_and_zero_support():
    node = _node([], ["D"], ["u1", "u2"])              # base 0, penalties clamp at 0
    views = {}
    assert score_confidence(node, views) == 0.0


def test_dependency_risk_picks_biggest_contributor():
    node = _node(["A", "B", "C"], [], [])
    support_map = {"A": 1.0, "B": 3.0, "C": 1.0}       # total 5, B is critical
    assert dependency_risk(node, support_map) == {"critical_artefact": "B", "drop": 0.6}


def test_dependency_risk_ties_break_on_smallest_id():
    node = _node(["A", "B"], [], [])
    support_map = {"B": 2.0, "A": 2.0}                 # tie -> smallest id "A"
    assert dependency_risk(node, support_map)["critical_artefact"] == "A"


def test_dependency_risk_empty_map():
    node = _node([], [], [])
    assert dependency_risk(node, {}) == {"critical_artefact": None, "drop": 0.0}
