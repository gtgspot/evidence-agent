def test_governance_public_api_importable():
    from evidence_agent.governance import (
        init_governance_schema,
        ALLOWED_TRANSITIONS, LineageError, governed_add,
        CustodyEvent, record_custody_event, list_custody, verify_integrity,
        link_issue, list_linked_issues,
        export_manifest, detect_path_collisions, duplicate_report,
        Claim, check_claim_anchoring,
    )
    from evidence_agent.core import ArtefactClass
    assert ArtefactClass.ORIGINAL in ALLOWED_TRANSITIONS
