import json

import evidence_agent.__main__ as cli
from evidence_agent.core import db, ArtefactClass, add_artefact, list_artefacts
from evidence_agent.core.hashing import sha256_file
from evidence_agent.governance.custody import list_custody
from evidence_agent.schema import init_all


def _seed_db(path):
    """A schema-initialised matter DB at `path`, returned as an open connection."""
    conn = db.connect(path)
    init_all(conn)
    return conn


def _add_original(conn, tmp_path, name, data, matter="M1"):
    p = tmp_path / name
    p.write_bytes(data)
    return add_artefact(conn, matter, ArtefactClass.ORIGINAL, "src", p)


# --- item 1: compile reuses core.hashing.sha256_file -------------------------

def test_compile_uses_core_hashing(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "a.txt").write_bytes(b"hello")
    out = tmp_path / "out.json"

    manifest = cli.compile_manifest(src, out, include_hidden=False)

    entry = next(e for e in manifest["files"] if e["path"] == "a.txt")
    assert entry["sha256"] == sha256_file(src / "a.txt")
    # the private helper must be gone; hashing is delegated to core.
    assert not hasattr(cli, "_sha256")


# --- item 2: run(argv) seam --------------------------------------------------

def test_run_compile_subcommand(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "a.txt").write_bytes(b"hello")
    out = tmp_path / "out.json"

    rc = cli.run(["compile", "--source", str(src), "--output", str(out)])

    assert rc == 0
    assert out.exists()
    data = json.loads(out.read_text())
    assert data["file_count"] == 1


def test_run_defaults_to_compile(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "a.txt").write_bytes(b"hello")

    rc = cli.run([])

    assert rc == 0
    assert (tmp_path / "build" / "evidence_bundle.json").exists()


# --- item 3: init subcommand -------------------------------------------------

def test_init_subcommand(tmp_path, capsys):
    dbpath = tmp_path / "matter.db"

    rc = cli.run(["init", "--db", str(dbpath)])

    assert rc == 0
    assert capsys.readouterr().out.strip() == f"Initialised matter DB at {dbpath}"
    # tables from init_all exist and are queryable.
    conn = db.connect(dbpath)
    tables = {
        r[0]
        for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    conn.close()
    assert "artefacts" in tables
    assert "discovery_requests" in tables


# --- item 4: manifest subcommand ---------------------------------------------

def test_manifest_subcommand(tmp_path, capsys):
    dbpath = tmp_path / "matter.db"
    conn = _seed_db(dbpath)
    a = _add_original(conn, tmp_path, "a", b"same")
    b = _add_original(conn, tmp_path, "b", b"same")  # duplicate content
    conn.close()

    rc = cli.run(["manifest", "--db", str(dbpath), "--matter", "M1"])

    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    assert {row["id"] for row in payload["manifest"]} == {a.id, b.id}
    assert list(payload["duplicates"].values()) == [sorted([a.id, b.id])]


# --- item 5: verify subcommand -----------------------------------------------

def test_verify_subcommand_all_ok(tmp_path, capsys):
    dbpath = tmp_path / "matter.db"
    conn = _seed_db(dbpath)
    a = _add_original(conn, tmp_path, "a", b"alpha")
    conn.close()

    rc = cli.run(["verify", "--db", str(dbpath), "--matter", "M1"])

    assert rc == 0
    assert capsys.readouterr().out.strip().splitlines() == [f"{a.id} OK"]


def test_verify_subcommand_detects_tamper(tmp_path, capsys):
    dbpath = tmp_path / "matter.db"
    conn = _seed_db(dbpath)
    a = _add_original(conn, tmp_path, "a", b"alpha")
    b = _add_original(conn, tmp_path, "b", b"beta")
    conn.close()
    (tmp_path / "b").write_bytes(b"TAMPERED")  # hash no longer matches stored

    rc = cli.run(["verify", "--db", str(dbpath), "--matter", "M1"])

    assert rc == 1
    assert capsys.readouterr().out.strip().splitlines() == [f"{a.id} OK", f"{b.id} FAIL"]


# --- item 6: discovery subcommand --------------------------------------------

def test_discovery_subcommand(tmp_path, capsys):
    from evidence_agent.discovery.register import add_request

    dbpath = tmp_path / "matter.db"
    conn = _seed_db(dbpath)
    req = add_request(
        conn, "M1", date_requested="2026-01-01", due_date="2026-02-01",
        legal_basis="s.42", item_sought="brief of evidence",
    )
    conn.close()

    rc = cli.run(
        ["discovery", "--db", str(dbpath), "--matter", "M1", "--as-of", "2026-03-01"]
    )

    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    # register: enum serialised to its value, not "OutcomeState.NO_RESPONSE".
    assert [r["request_id"] for r in payload["register"]] == [req.request_id]
    assert payload["register"][0]["result"] == "No Response"
    # escalation: overdue (as-of is past the due date).
    assert [e["request_id"] for e in payload["escalation"]] == [req.request_id]
    assert payload["escalation"][0]["reason"] == "OVERDUE"


# --- item 7: ingest subcommand -------------------------------------------------

def test_ingest_subcommand_registers_originals(tmp_path, capsys):
    src = tmp_path / "repo"
    (src / "docs").mkdir(parents=True)
    (src / "a.txt").write_bytes(b"alpha")
    (src / "docs" / "b.txt").write_bytes(b"beta")
    dbpath = tmp_path / "matter.db"

    rc = cli.run(
        ["ingest", "--db", str(dbpath), "--matter", "M1", "--source", str(src)]
    )

    assert rc == 0
    assert "Ingested 2 files (0 already registered)" in capsys.readouterr().out

    conn = db.connect(dbpath)
    arts = list_artefacts(conn, "M1")
    assert {a.metadata["relative_path"] for a in arts} == {"a.txt", "docs/b.txt"}
    for art in arts:
        assert art.cls is ArtefactClass.ORIGINAL
        assert art.source == "repo"  # label defaults to the source dir name
        assert art.sha256 == sha256_file(art.path)
        events = list_custody(conn, art.id)
        assert [e.event for e in events] == ["ingested"]
        assert events[0].actor == "evidence-agent"
    conn.close()


def test_ingest_subcommand_is_idempotent(tmp_path, capsys):
    src = tmp_path / "repo"
    src.mkdir()
    (src / "a.txt").write_bytes(b"alpha")
    dbpath = tmp_path / "matter.db"
    argv = ["ingest", "--db", str(dbpath), "--matter", "M1", "--source", str(src)]

    assert cli.run(argv) == 0
    capsys.readouterr()
    (src / "b.txt").write_bytes(b"beta")  # only the new file registers on re-run

    rc = cli.run(argv)

    assert rc == 0
    assert "Ingested 1 files (1 already registered)" in capsys.readouterr().out
    conn = db.connect(dbpath)
    assert len(list_artefacts(conn, "M1")) == 2
    conn.close()


def test_ingest_subcommand_skips_db_inside_source(tmp_path, capsys):
    src = tmp_path / "repo"
    src.mkdir()
    (src / "a.txt").write_bytes(b"alpha")
    dbpath = src / "matter.db"  # DB lives inside the ingested tree

    rc = cli.run(
        ["ingest", "--db", str(dbpath), "--matter", "M1", "--source", str(src)]
    )

    assert rc == 0
    conn = db.connect(dbpath)
    arts = list_artefacts(conn, "M1")
    conn.close()
    assert [a.metadata["relative_path"] for a in arts] == ["a.txt"]
