"""Workspace artefact governance agent — public API."""
from evidence_agent.governance.schema import init_governance_schema
from evidence_agent.governance.classes import (
    ALLOWED_TRANSITIONS, LineageError, governed_add,
)
from evidence_agent.governance.custody import (
    CustodyEvent, record_custody_event, list_custody, verify_integrity,
    link_issue, list_linked_issues,
)
from evidence_agent.governance.manifest import (
    export_manifest, detect_path_collisions, duplicate_report,
)
from evidence_agent.governance.linkcheck import Claim, check_claim_anchoring

__all__ = [
    "init_governance_schema",
    "ALLOWED_TRANSITIONS", "LineageError", "governed_add",
    "CustodyEvent", "record_custody_event", "list_custody", "verify_integrity",
    "link_issue", "list_linked_issues",
    "export_manifest", "detect_path_collisions", "duplicate_report",
    "Claim", "check_claim_anchoring",
]
