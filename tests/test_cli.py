import json

import evidence_agent.__main__ as cli
from evidence_agent.core.hashing import sha256_file


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
