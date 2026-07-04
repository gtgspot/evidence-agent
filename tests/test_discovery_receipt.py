import pytest
from evidence_agent.core import sha256_file
from evidence_agent.discovery.schema import init_discovery_schema
from evidence_agent.discovery.register import add_request
from evidence_agent.discovery.receipt import (
    ReceiptCheck, record_receipt, receipt_ok, list_receipts,
)


@pytest.fixture
def dconn(conn):
    init_discovery_schema(conn)
    return conn


def _request(dconn):
    return add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "Brief")


def test_record_receipt_integrity_pass(dconn, tmp_path):
    _request(dconn)
    p = tmp_path / "production.pdf"
    p.write_bytes(b"disclosed material")
    expected = sha256_file(p)
    rc = record_receipt(
        dconn, "M1", "REQ-0001", p, expected,
        completeness=True, redactions_present=False, answers_request=True,
    )
    assert isinstance(rc, ReceiptCheck)
    assert rc.receipt_id == "RCP-0001"
    assert rc.file_integrity is True
    assert rc.computed_sha256 == expected
    assert receipt_ok(rc) is True


def test_record_receipt_integrity_fail_on_hash_mismatch(dconn, tmp_path):
    _request(dconn)
    p = tmp_path / "production.pdf"
    p.write_bytes(b"tampered material")
    rc = record_receipt(
        dconn, "M1", "REQ-0001", p, "deadbeef",
        completeness=True, redactions_present=True, answers_request=True,
    )
    assert rc.file_integrity is False
    assert receipt_ok(rc) is False


def test_receipt_ok_requires_answers_request(dconn, tmp_path):
    _request(dconn)
    p = tmp_path / "production.pdf"
    p.write_bytes(b"x")
    rc = record_receipt(
        dconn, "M1", "REQ-0001", p, sha256_file(p),
        completeness=True, redactions_present=False, answers_request=False,
        answers_note="Does not cover the CCTV sought",
    )
    assert receipt_ok(rc) is False
    assert rc.answers_note == "Does not cover the CCTV sought"
    assert list_receipts(dconn, "REQ-0001") == [rc]
