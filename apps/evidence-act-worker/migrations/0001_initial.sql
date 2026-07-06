CREATE TABLE IF NOT EXISTS instruments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  version TEXT,
  version_date TEXT,
  source_status TEXT,
  checksum TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS legal_rules (
  id TEXT PRIMARY KEY,
  instrument_id TEXT NOT NULL,
  section TEXT NOT NULL,
  subsection TEXT,
  title TEXT,
  cluster_id TEXT,
  rule_type TEXT,
  text TEXT,
  source_citation TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instrument_id) REFERENCES instruments(id)
);

CREATE TABLE IF NOT EXISTS rule_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_rule_id TEXT NOT NULL,
  to_rule_id TEXT NOT NULL,
  relationship TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matters (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  jurisdiction TEXT,
  court TEXT,
  posture TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS charges (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL,
  label TEXT NOT NULL,
  statute TEXT NOT NULL,
  provision TEXT NOT NULL,
  status TEXT,
  elements_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (matter_id) REFERENCES matters(id)
);

CREATE TABLE IF NOT EXISTS facts_in_issue (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL,
  charge_id TEXT,
  issue TEXT NOT NULL,
  proof_required_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (matter_id) REFERENCES matters(id),
  FOREIGN KEY (charge_id) REFERENCES charges(id)
);

CREATE TABLE IF NOT EXISTS evidence_items (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_path TEXT,
  timestamp TEXT,
  tendering_party TEXT,
  opposing_party TEXT,
  fact_asserted TEXT,
  fact_in_issue TEXT,
  purpose_of_tender_json TEXT,
  linked_charge_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (matter_id) REFERENCES matters(id),
  FOREIGN KEY (linked_charge_id) REFERENCES charges(id)
);

CREATE TABLE IF NOT EXISTS admissibility_reports (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL,
  classification TEXT,
  legal_effect_json TEXT,
  gate_results_json TEXT,
  final_status TEXT,
  voir_dire_required INTEGER DEFAULT 0,
  advance_ruling_candidate INTEGER DEFAULT 0,
  counsel_priority TEXT,
  missing_proof_json TEXT,
  extension_report_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id)
);

CREATE TABLE IF NOT EXISTS objections (
  id TEXT PRIMARY KEY,
  report_id TEXT,
  evidence_id TEXT,
  objection_type TEXT NOT NULL,
  legal_basis TEXT,
  rationale_json TEXT,
  response_json TEXT,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES admissibility_reports(id),
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id)
);

CREATE TABLE IF NOT EXISTS extension_reports (
  id TEXT PRIMARY KEY,
  matter_id TEXT,
  evidence_id TEXT,
  report_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (matter_id) REFERENCES matters(id),
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  matter_id TEXT,
  evidence_id TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_evidence_matter ON evidence_items(matter_id);
CREATE INDEX IF NOT EXISTS idx_reports_evidence ON admissibility_reports(evidence_id);
CREATE INDEX IF NOT EXISTS idx_ledger_matter ON ledger_entries(matter_id);
CREATE INDEX IF NOT EXISTS idx_objections_report ON objections(report_id);
