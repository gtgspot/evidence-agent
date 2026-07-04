from evidence_agent.core.artefact import ArtefactClass, add_artefact
from evidence_agent.core.manifest import find_duplicate_hashes, manifest_rows


def _add(conn, tmp_path, name, data):
    p = tmp_path / name; p.write_bytes(data)
    return add_artefact(conn, "M1", ArtefactClass.ORIGINAL, "s", p)


def test_find_duplicate_hashes(conn, tmp_path):
    a = _add(conn, tmp_path, "a", b"same")
    b = _add(conn, tmp_path, "b", b"same")   # identical content
    _add(conn, tmp_path, "c", b"different")
    dupes = find_duplicate_hashes(conn, "M1")
    assert list(dupes.values()) == [sorted([a.id, b.id])]


def test_manifest_rows_shape(conn, tmp_path):
    _add(conn, tmp_path, "a", b"x")
    rows = manifest_rows(conn, "M1")
    assert set(rows[0]) >= {"id", "cls", "path", "sha256", "source"}
