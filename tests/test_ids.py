from evidence_agent.core.ids import new_id


def test_ids_increment_per_prefix(conn):
    assert new_id(conn, "ART") == "ART-0001"
    assert new_id(conn, "ART") == "ART-0002"
    assert new_id(conn, "ANC") == "ANC-0001"  # independent counter


def test_ids_persist_across_calls(conn):
    for _ in range(11):
        last = new_id(conn, "REQ")
    assert last == "REQ-0011"
