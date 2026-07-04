def test_public_contract_importable():
    from evidence_agent.core import (
        db, ArtefactClass, Artefact, ImmutableOriginalError,
        add_artefact, get_artefact, list_artefacts,
        EvidenceAnchor, add_anchor, list_anchors,
        new_id, sha256_file, sha256_bytes,
        find_duplicate_hashes, manifest_rows,
    )
    assert ArtefactClass.ORIGINAL.value == "Original"
