"""Shared evidence/artefact substrate — canonical contract."""
from evidence_agent.core import db
from evidence_agent.core.ids import new_id
from evidence_agent.core.hashing import sha256_file, sha256_bytes
from evidence_agent.core.artefact import (
    ArtefactClass, Artefact, ImmutableOriginalError,
    add_artefact, get_artefact, list_artefacts,
)
from evidence_agent.core.anchor import EvidenceAnchor, add_anchor, list_anchors
from evidence_agent.core.manifest import find_duplicate_hashes, manifest_rows

__all__ = [
    "db", "new_id", "sha256_file", "sha256_bytes",
    "ArtefactClass", "Artefact", "ImmutableOriginalError",
    "add_artefact", "get_artefact", "list_artefacts",
    "EvidenceAnchor", "add_anchor", "list_anchors",
    "find_duplicate_hashes", "manifest_rows",
]
