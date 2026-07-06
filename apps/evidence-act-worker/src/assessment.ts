import type {
  AdmissibilityReport,
  EvidenceItem,
  ExtensionReport,
  GateResult,
} from "./types";

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function classifyEvidence(item: EvidenceItem): string {
  const source = item.source_type.toLowerCase();
  const title = item.title.toLowerCase();

  if (source.includes("body") || title.includes("bwc")) {
    return "audio_visual_recording";
  }

  if (source.includes("cad")) {
    return "computer_aided_dispatch_record";
  }

  if (source.includes("leap")) {
    return "official_police_database_record";
  }

  if (source.includes("certificate") || title.includes("certificate")) {
    return "statutory_or_expert_certificate";
  }

  if (source.includes("email") || source.includes("correspondence")) {
    return "electronic_communication";
  }

  return "unclassified_evidence_item";
}

export function splitPurposes(item: EvidenceItem): Record<string, boolean> {
  const purposes = new Set(item.purpose_of_tender.map((p) => p.toLowerCase()));

  return {
    truth: purposes.has("truth"),
    credibility: purposes.has("credibility"),
    context: purposes.has("context"),
    state_of_investigation: purposes.has("state_of_investigation"),
    admissibility: purposes.has("admissibility"),
    non_hearsay: purposes.has("non_hearsay"),
    proof: purposes.has("proof"),
  };
}

export function classifyLegalEffect(item: EvidenceItem): string[] {
  const p = splitPurposes(item);
  const effects: string[] = [];

  if (p.truth) effects.push("foundation_required");
  if (p.credibility) effects.push("credibility_only");
  if (p.admissibility) {
    effects.push("admissibility_only");
    effects.push("voir_dire_trigger");
    effects.push("advance_ruling_candidate");
  }
  if (item.purpose_of_tender.join(" ").toLowerCase().includes("s138")) {
    effects.push("s138_support");
  }

  if (effects.length === 0) effects.push("foundation_required");

  return unique(effects);
}

export function relevanceGate(item: EvidenceItem): GateResult {
  if (!item.fact_in_issue) {
    return {
      gate: "relevance",
      status: "fail",
      triggered_sections: ["Evidence Act 2008 (Vic) ss 55-56"],
      reasons: ["No fact in issue supplied."],
      objections: [],
      responses: [],
      missing_proof: ["fact_in_issue"],
      assumptions: [],
    };
  }

  return {
    gate: "relevance",
    status: "contestable",
    triggered_sections: ["Evidence Act 2008 (Vic) ss 55-56"],
    reasons: [
      "Evidence may rationally affect assessment of the identified fact in issue.",
      "Final relevance depends on the accepted purpose of tender and factual foundation.",
    ],
    objections: [],
    responses: [
      "Identify the precise fact in issue and purpose of tender before arguing admissibility.",
    ],
    missing_proof: ["source extract", "full context", "tender purpose precision"],
    assumptions: ["Evidence description is accepted only as an intake summary."],
  };
}

export function hearsayGate(item: EvidenceItem): GateResult {
  const p = splitPurposes(item);

  if (p.truth) {
    return {
      gate: "hearsay",
      status: "contestable",
      triggered_sections: ["Evidence Act 2008 (Vic) ss 59-75"],
      reasons: [
        "Truth use may trigger hearsay analysis if the evidence contains a previous representation.",
      ],
      objections: ["hearsay"],
      responses: [
        "Clarify whether the evidence is also tendered for a non-hearsay purpose, credibility, context, or state of investigation.",
      ],
      missing_proof: ["maker of representation", "asserted fact", "availability of maker"],
      assumptions: [],
    };
  }

  return {
    gate: "hearsay",
    status: "not_assessed",
    triggered_sections: ["Evidence Act 2008 (Vic) ss 59-75"],
    reasons: ["No truth purpose identified at intake."],
    objections: [],
    responses: [],
    missing_proof: [],
    assumptions: [],
  };
}

export function opinionGate(item: EvidenceItem): GateResult {
  const text = `${item.title} ${item.fact_asserted ?? ""}`.toLowerCase();

  if (!text.includes("opinion") && !text.includes("indicates") && !text.includes("i think")) {
    return {
      gate: "opinion",
      status: "not_assessed",
      triggered_sections: ["Evidence Act 2008 (Vic) ss 76-80"],
      reasons: ["No obvious opinion evidence detected."],
      objections: [],
      responses: [],
      missing_proof: [],
      assumptions: [],
    };
  }

  return {
    gate: "opinion",
    status: "contestable",
    triggered_sections: ["Evidence Act 2008 (Vic) ss 76-80"],
    reasons: ["Opinion-like evidence detected."],
    objections: ["opinion foundation", "specialised knowledge basis", "observed fact basis"],
    responses: [
      "Require the witness to identify observed facts, training, experience, and the reasoning path from observation to conclusion.",
    ],
    missing_proof: ["training", "experience", "observed facts", "device/manual foundation"],
    assumptions: [],
  };
}

export function admissionsGate(item: EvidenceItem): GateResult {
  const text = `${item.title} ${item.fact_asserted ?? ""}`.toLowerCase();
  const likelyAdmission =
    text.includes("admit") ||
    text.includes("admission") ||
    text.includes("said he") ||
    text.includes("said she");

  if (!likelyAdmission) {
    return {
      gate: "admissions",
      status: "not_assessed",
      triggered_sections: ["Evidence Act 2008 (Vic) ss 81-90"],
      reasons: ["No clear admission content detected at intake."],
      objections: [],
      responses: [],
      missing_proof: [],
      assumptions: [],
    };
  }

  return {
    gate: "admissions",
    status: "contestable",
    triggered_sections: ["Evidence Act 2008 (Vic) ss 81-90"],
    reasons: ["Admission-like content detected and requires reliability pathway checks."],
    objections: ["admission reliability", "questioning context"],
    responses: ["Require questioning context, caution pathway, and reliability foundation."],
    missing_proof: ["questioning context", "reliability foundation", "admission pathway"],
    assumptions: [],
  };
}

export function credibilityGate(item: EvidenceItem): GateResult {
  const p = splitPurposes(item);
  if (!p.credibility && !p.state_of_investigation) {
    return {
      gate: "credibility",
      status: "not_assessed",
      triggered_sections: ["Evidence Act 2008 (Vic) ss 101A-108C"],
      reasons: ["No explicit credibility purpose identified."],
      objections: [],
      responses: [],
      missing_proof: [],
      assumptions: [],
    };
  }

  return {
    gate: "credibility",
    status: "contestable",
    triggered_sections: ["Evidence Act 2008 (Vic) ss 101A-108C"],
    reasons: ["Credibility pathway engaged by tender purpose and requires specificity."],
    objections: ["credibility scope", "collateral issue risk"],
    responses: ["Identify contradiction pathway and narrow the credibility purpose."],
    missing_proof: ["contradiction point", "credibility purpose precision"],
    assumptions: [],
  };
}

export function exclusionGate(item: EvidenceItem): GateResult {
  const p = splitPurposes(item);

  if (p.admissibility) {
    return {
      gate: "exclusion",
      status: "contestable",
      triggered_sections: ["Evidence Act 2008 (Vic) ss 135-139"],
      reasons: [
        "Admissibility purpose detected; exclusionary discretion may be engaged.",
        "If illegality or impropriety is alleged, source of power must be resolved first.",
      ],
      objections: ["s135", "s137", "s138"],
      responses: [
        "Separate the alleged impropriety, source of power, causal chain, probative value, prejudice, and public-interest factors.",
      ],
      missing_proof: [
        "source of power",
        "alleged impropriety",
        "causal connection",
        "probative value",
        "prejudice",
      ],
      assumptions: ["The Evidence Act consequence depends on external source-of-power analysis."],
    };
  }

  return {
    gate: "exclusion",
    status: "not_assessed",
    triggered_sections: ["Evidence Act 2008 (Vic) ss 135-139"],
    reasons: ["No exclusion purpose identified yet."],
    objections: [],
    responses: [],
    missing_proof: [],
    assumptions: [],
  };
}

export function proofGate(_item: EvidenceItem): GateResult {
  return {
    gate: "proof",
    status: "contestable",
    triggered_sections: ["Evidence Act 2008 (Vic) Chapter 4"],
    reasons: [
      "Proof pathway depends on evidence type: document, recording, official record, machine output, certificate, or witness evidence.",
    ],
    objections: ["authentication", "foundation"],
    responses: [
      "Identify the correct proof mechanism for the evidence type and produce authentication metadata.",
    ],
    missing_proof: ["authentication", "source metadata", "witness foundation", "document provenance"],
    assumptions: [],
  };
}

export function buildExtensionReport(item: EvidenceItem): ExtensionReport {
  const text = `${item.title} ${item.source_type} ${item.fact_in_issue}`.toLowerCase();

  const statutes: string[] = [];
  const regulations: string[] = [];
  const modules: string[] = [];
  const schema: string[] = [];

  if (
    text.includes("road safety") ||
    text.includes("licence") ||
    text.includes("poft") ||
    text.includes("oral fluid")
  ) {
    statutes.push("Road Safety Act 1986 (Vic)");
    regulations.push("Road Safety Regulations");
    modules.push("Road Safety Act source-of-power resolver");
  }

  if (text.includes("certificate")) {
    modules.push("certificate auditor");
    schema.push("certificate_type", "certificate_date", "signatory", "service_status");
  }

  if (text.includes("bwc") || text.includes("body") || text.includes("camera")) {
    modules.push("BWC metadata extractor");
    schema.push("recording_start_time", "device_id", "operator_id");
  }

  modules.push("case law authority layer");
  modules.push("cross-examination generator");
  modules.push("counsel handover generator");

  return {
    new_statutes_needed: unique(statutes),
    new_regulations_needed: unique(regulations),
    new_case_law_needed: [],
    new_evidence_types_detected: [],
    new_schema_fields_recommended: unique(schema),
    new_runtime_modules_recommended: unique(modules),
    next_build_step: [
      "Add exact Road Safety Act provisions for external source-of-power resolution.",
      "Add section parser for Evidence Act source text.",
      "Add real evidence_index ingestion.",
    ],
  };
}

export function assessEvidence(item: EvidenceItem): AdmissibilityReport {
  const gates = [
    relevanceGate(item),
    hearsayGate(item),
    opinionGate(item),
    admissionsGate(item),
    credibilityGate(item),
    exclusionGate(item),
    proofGate(item),
  ];

  const missing = unique(gates.flatMap((g) => g.missing_proof));
  const assumptions = unique(gates.flatMap((g) => g.assumptions));
  const legalEffect = classifyLegalEffect(item);
  const extension = buildExtensionReport(item);
  const nextExtensionModule = extension.next_build_step[0] ?? "No extension module identified.";
  const counterargument =
    "Counterargument: the opposing party may submit that any defects are weight-only and do not defeat admissibility.";

  return {
    id: crypto.randomUUID(),
    evidence_id: item.id,
    classification: classifyEvidence(item),
    legal_effect: legalEffect,
    gate_results: gates,
    final_status: "contestable",
    voir_dire_required: legalEffect.includes("voir_dire_trigger"),
    advance_ruling_candidate: legalEffect.includes("advance_ruling_candidate"),
    counsel_priority: "requires_triage",
    missing_proof_global: missing,
    assumptions_global: assumptions,
    counterargument,
    next_extension_module: nextExtensionModule,
    extension_report: extension,
  };
}
