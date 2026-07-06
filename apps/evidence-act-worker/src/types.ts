export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  EVIDENCE_FILES?: R2Bucket;
  AI?: Ai;
  VECTOR_INDEX?: Vectorize;

  APP_NAME: string;
  APP_ENV?: string;
  DEFAULT_JURISDICTION: string;
  DEFAULT_INSTRUMENT: string;
  DEFAULT_VERSION: string;
  DEFAULT_VERSION_DATE: string;
  LAST_DEPLOY_AT?: string;
  AUTH_REQUIRED?: string;
  VECTOR_NAMESPACE?: string;
  VECTOR_EMBED_MODEL?: string;

  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DASHBOARD_API_KEY?: string;
}

export type GateStatus =
  | "pass"
  | "fail"
  | "contestable"
  | "not_assessed";

export interface EvidenceItem {
  id: string;
  matter_id: string;
  title: string;
  source_type: string;
  source_path?: string;
  timestamp?: string;
  tendering_party?: string;
  opposing_party?: string;
  fact_asserted?: string;
  fact_in_issue: string;
  purpose_of_tender: string[];
  linked_charge_id?: string;
  notes?: string;
}

export interface GateResult {
  gate: string;
  status: GateStatus;
  triggered_sections: string[];
  reasons: string[];
  objections: string[];
  responses: string[];
  missing_proof: string[];
  assumptions: string[];
  authority_matches?: Array<{
    citation: string;
    canonical_ref: string;
    source_title: string;
    source_uri: string;
    heading: string | null;
    excerpt: string;
  }>;
}

export interface ExtensionReport {
  new_statutes_needed: string[];
  new_regulations_needed: string[];
  new_case_law_needed: string[];
  new_evidence_types_detected: string[];
  new_schema_fields_recommended: string[];
  new_runtime_modules_recommended: string[];
  next_build_step: string[];
}

export interface AdmissibilityReport {
  id: string;
  evidence_id: string;
  classification: string;
  legal_effect: string[];
  gate_results: GateResult[];
  final_status: GateStatus;
  voir_dire_required: boolean;
  advance_ruling_candidate: boolean;
  counsel_priority: string;
  missing_proof_global: string[];
  assumptions_global: string[];
  counterargument: string;
  next_extension_module: string;
  extension_report: ExtensionReport;
  authority_coverage?: {
    retrieval_mode: string;
    requested_citations: number;
    matched_citations: number;
    unmatched_citations: string[];
    source_titles: string[];
  };
}

export interface HealthPayload {
  ok: boolean;
  app: string;
  environment: string;
  instrument: string;
  version: string;
  version_date: string;
  bindings?: {
    r2_bound: boolean;
    ai_bound: boolean;
    vectorize_bound: boolean;
    vector_namespace: string;
    vector_embed_model: string;
  };
  d1: {
    bound: boolean;
    ok: boolean;
    error?: string;
  };
  metrics: {
    matters: number;
    evidence_items: number;
    admissibility_reports: number;
    ledger_entries: number;
    last_ledger_entry_at: string | null;
  };
}
