def test_discovery_contract_importable():
    from evidence_agent.discovery import (
        init_discovery_schema,
        OutcomeState, DiscoveryRequest,
        add_request, update_result, get_request, list_requests,
        ReceiptCheck, record_receipt, receipt_ok, list_receipts,
        RedactionEntry, add_redaction, list_redactions,
        EscalationItem, build_escalation_queue,
    )
    assert OutcomeState.CLAIMED_NON_EXISTENCE.value == "Claimed Non-Existence"
    assert {s.value for s in OutcomeState} == {
        "Produced", "Partially Produced", "Refused",
        "No Response", "Claimed Non-Existence",
    }
