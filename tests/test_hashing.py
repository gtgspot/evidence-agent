import hashlib
from evidence_agent.core.hashing import sha256_bytes, sha256_file


def test_sha256_bytes_matches_hashlib():
    assert sha256_bytes(b"abc") == hashlib.sha256(b"abc").hexdigest()


def test_sha256_file_matches_bytes(tmp_path):
    p = tmp_path / "doc.txt"
    p.write_bytes(b"evidence")
    assert sha256_file(p) == sha256_bytes(b"evidence")
