import sqlite3
import pytest
from evidence_agent.core import db


@pytest.fixture
def conn(tmp_path):
    """A fresh, schema-initialised SQLite connection backed by a temp file."""
    c = db.connect(tmp_path / "matter.db")
    db.init_schema(c)
    yield c
    c.close()
