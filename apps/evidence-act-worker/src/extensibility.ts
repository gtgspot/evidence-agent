import type { EvidenceItem, ExtensionReport } from "./types";

export function inferExtensibilityHints(item: EvidenceItem): ExtensionReport {
  const text = `${item.title} ${item.source_type} ${item.fact_in_issue}`.toLowerCase();

  return {
    new_statutes_needed: text.includes("road safety") ? ["Road Safety Act 1986 (Vic)"] : [],
    new_regulations_needed: text.includes("regulation") ? ["Road Safety Regulations"] : [],
    new_case_law_needed: ["Authority mapping by neutral citation"],
    new_evidence_types_detected: [],
    new_schema_fields_recommended: [],
    new_runtime_modules_recommended: ["authority-version pinning", "proof-gap clustering"],
    next_build_step: ["Implement corpus-aware legal authority resolver."],
  };
}
