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
