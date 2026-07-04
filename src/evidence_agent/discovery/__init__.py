"""Discovery Management Agent — register, receipts, redactions, escalation."""
from evidence_agent.discovery.schema import init_discovery_schema
from evidence_agent.discovery.register import (
    OutcomeState, DiscoveryRequest,
    add_request, update_result, get_request, list_requests,
)
from evidence_agent.discovery.receipt import (
    ReceiptCheck, record_receipt, receipt_ok, list_receipts,
)
from evidence_agent.discovery.redaction import (
    RedactionEntry, add_redaction, list_redactions,
)
from evidence_agent.discovery.escalation import (
    EscalationItem, build_escalation_queue,
)

__all__ = [
    "init_discovery_schema",
    "OutcomeState", "DiscoveryRequest",
    "add_request", "update_result", "get_request", "list_requests",
    "ReceiptCheck", "record_receipt", "receipt_ok", "list_receipts",
    "RedactionEntry", "add_redaction", "list_redactions",
    "EscalationItem", "build_escalation_queue",
]
