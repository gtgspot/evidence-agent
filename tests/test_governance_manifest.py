import pytest
from evidence_agent.core import ArtefactClass, add_artefact, manifest_rows, find_duplicate_hashes
from evidence_agent.governance.schema import init_governance_schema
from evidence_agent.governance.manifest import (
    export_manifest, detect_path_collisions, duplicate_report,
)


@pytest.fixture
def gconn(conn):
    init_governance_schema(conn)
    return conn


def _add(gconn, path, source, data):
    path.write_bytes(data)
    return add_artefact(gconn, "M1", ArtefactClass.ORIGINAL, source, path)


def test_export_manifest_matches_core(gconn, tmp_path):
    _add(gconn, tmp_path / "a", "s", b"x")
    rows = export_manifest(gconn, "M1")
    assert rows == manifest_rows(gconn, "M1")
    assert {"id", "cls", "path", "sha256", "source"} <= set(rows[0])


def test_detect_path_collisions(gconn, tmp_path):
    shared = tmp_path / "shared"
    a = _add(gconn, shared, "first", b"x")
    b = _add(gconn, shared, "second", b"x")  # same path reused
    _add(gconn, tmp_path / "solo", "s", b"y")
    cols = detect_path_collisions(gconn, "M1")
    assert list(cols.values()) == [sorted([a.id, b.id])]


def test_duplicate_report_delegates_to_core(gconn, tmp_path):
    _add(gconn, tmp_path / "a", "s", b"same")
    _add(gconn, tmp_path / "b", "s", b"same")
    assert duplicate_report(gconn, "M1") == find_duplicate_hashes(gconn, "M1")
