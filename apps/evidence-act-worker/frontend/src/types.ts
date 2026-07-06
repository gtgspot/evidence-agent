export interface DashboardEvidenceItem {
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
  status: "pass" | "fail" | "contestable" | "not_assessed";
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

export interface AdmissibilityReport {
  id: string;
  evidence_id: string;
  classification: string;
  legal_effect: string[];
  gate_results: GateResult[];
  final_status: "pass" | "fail" | "contestable" | "not_assessed";
  voir_dire_required: boolean;
  advance_ruling_candidate: boolean;
  counsel_priority: string;
  missing_proof_global: string[];
  assumptions_global: string[];
  counterargument: string;
  next_extension_module: string;
  extension_report: {
    next_build_step: string[];
    new_runtime_modules_recommended: string[];
    [key: string]: unknown;
  };
  authority_coverage?: {
    retrieval_mode: string;
    requested_citations: number;
    matched_citations: number;
    unmatched_citations: string[];
    source_titles: string[];
  };
}

export interface EvidenceRegisterRow {
  title: string;
  source: string;
  date: string;
  itemType: string;
  tenderPurpose: string;
  linkedFactInIssue: string;
  linkedStatutoryRules: string[];
  admissibilityStatus: string;
  identifiedDefects: string[];
  nextAction: string;
  report?: AdmissibilityReport;
}
