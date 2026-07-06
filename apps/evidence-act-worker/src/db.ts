import type { AdmissibilityReport, Env, EvidenceItem } from "./types";

function normalizeIdPart(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function stableId(prefix: string, ...parts: string[]): string {
  const body = parts
    .map((part) => normalizeIdPart(part))
    .filter((part) => part.length > 0)
    .join("-");
  const fallback = body.length > 0 ? body : crypto.randomUUID();
  return `${prefix}-${fallback}`.slice(0, 240);
}

function instrumentId(env: Env): string {
  return stableId("inst", env.DEFAULT_INSTRUMENT, env.DEFAULT_VERSION, env.DEFAULT_VERSION_DATE);
}

export async function ensureMatterAndChargeRecords(env: Env, item: EvidenceItem): Promise<void> {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO matters (
      id,
      title,
      jurisdiction,
      posture
    )
    VALUES (?, ?, ?, ?)
  `)
    .bind(
      item.matter_id,
      `Matter ${item.matter_id}`,
      env.DEFAULT_JURISDICTION,
      "intake",
    )
    .run();

  if (!item.linked_charge_id) return;

  await env.DB.prepare(`
    INSERT OR IGNORE INTO charges (
      id,
      matter_id,
      label,
      statute,
      provision,
      status,
      elements_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      item.linked_charge_id,
      item.matter_id,
      item.linked_charge_id,
      "Unknown statute",
      "Unknown provision",
      "intake",
      JSON.stringify([]),
    )
    .run();
}

export async function probeDatabase(env: Env): Promise<{ bound: boolean; ok: boolean; error?: string }> {
  if (!env.DB) {
    return {
      bound: false,
      ok: false,
      error: "D1 binding env.DB is missing",
    };
  }

  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return {
      bound: true,
      ok: true,
    };
  } catch (error) {
    return {
      bound: true,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function countTable(env: Env, table: string): Promise<number> {
  try {
    const row = await env.DB
      .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
      .first<{ count: number }>();
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function healthMetrics(
  env: Env,
): Promise<{
  matters: number;
  evidence_items: number;
  admissibility_reports: number;
  ledger_entries: number;
  last_ledger_entry_at: string | null;
}> {
  if (!env.DB) {
    return {
      matters: 0,
      evidence_items: 0,
      admissibility_reports: 0,
      ledger_entries: 0,
      last_ledger_entry_at: null,
    };
  }

  const lastLedger = await env.DB
    .prepare(`
      SELECT created_at
      FROM ledger_entries
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .first<{ created_at: string }>()
    .catch(() => null);

  return {
    matters: await countTable(env, "matters"),
    evidence_items: await countTable(env, "evidence_items"),
    admissibility_reports: await countTable(env, "admissibility_reports"),
    ledger_entries: await countTable(env, "ledger_entries"),
    last_ledger_entry_at: lastLedger?.created_at ?? null,
  };
}

export async function ensureInstrumentRecord(env: Env): Promise<string> {
  const id = instrumentId(env);
  await env.DB.prepare(`
    INSERT OR IGNORE INTO instruments (
      id,
      name,
      jurisdiction,
      version,
      version_date,
      source_status
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `)
    .bind(
      id,
      env.DEFAULT_INSTRUMENT,
      env.DEFAULT_JURISDICTION,
      env.DEFAULT_VERSION,
      env.DEFAULT_VERSION_DATE,
      "worker_runtime",
    )
    .run();
  return id;
}

export async function upsertFactInIssue(env: Env, item: EvidenceItem): Promise<string> {
  await ensureMatterAndChargeRecords(env, item);
  const factId = stableId("fact", item.matter_id, item.linked_charge_id ?? "no-charge", item.fact_in_issue);
  const proofRequired = {
    evidence_id: item.id,
    source_type: item.source_type,
    purpose_of_tender: item.purpose_of_tender,
    linked_charge_id: item.linked_charge_id ?? null,
  };

  try {
    await env.DB.prepare(`
      INSERT INTO facts_in_issue (
        id,
        matter_id,
        charge_id,
        issue,
        proof_required_json
      )
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        proof_required_json = excluded.proof_required_json
    `)
      .bind(
        factId,
        item.matter_id,
        item.linked_charge_id ?? null,
        item.fact_in_issue,
        JSON.stringify(proofRequired),
      )
      .run();
  } catch {
    // Fall back to nullable charge_id if referenced charge has not been registered.
    await env.DB.prepare(`
      INSERT INTO facts_in_issue (
        id,
        matter_id,
        charge_id,
        issue,
        proof_required_json
      )
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        proof_required_json = excluded.proof_required_json
    `)
      .bind(
        factId,
        item.matter_id,
        null,
        item.fact_in_issue,
        JSON.stringify(proofRequired),
      )
      .run();
  }

  return factId;
}

export async function upsertRuleNodesFromReport(env: Env, report: AdmissibilityReport): Promise<string[]> {
  const instId = await ensureInstrumentRecord(env);
  const insertedRuleIds: string[] = [];
  const seen = new Set<string>();

  for (const gate of report.gate_results) {
    for (const section of gate.triggered_sections) {
      const ruleId = stableId("rule", instId, section);
      if (seen.has(ruleId)) continue;
      seen.add(ruleId);

      await env.DB.prepare(`
        INSERT INTO legal_rules (
          id,
          instrument_id,
          section,
          subsection,
          title,
          cluster_id,
          rule_type,
          text,
          source_citation
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          rule_type = excluded.rule_type,
          text = excluded.text,
          source_citation = excluded.source_citation
      `)
        .bind(
          ruleId,
          instId,
          section,
          null,
          `${gate.gate} gate`,
          null,
          "evidence_act_gate",
          section,
          section,
        )
        .run();

      insertedRuleIds.push(ruleId);
    }
  }

  return insertedRuleIds;
}

export async function insertObjectionsFromReport(env: Env, report: AdmissibilityReport): Promise<number> {
  let count = 0;

  for (const gate of report.gate_results) {
    if (gate.objections.length === 0) continue;

    for (const [index, objection] of gate.objections.entries()) {
      const id = stableId("obj", report.id, gate.gate, objection, String(index));
      await env.DB.prepare(`
        INSERT INTO objections (
          id,
          report_id,
          evidence_id,
          objection_type,
          legal_basis,
          rationale_json,
          response_json,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          legal_basis = excluded.legal_basis,
          rationale_json = excluded.rationale_json,
          response_json = excluded.response_json,
          status = excluded.status
      `)
        .bind(
          id,
          report.id,
          report.evidence_id,
          objection,
          gate.triggered_sections.join("; "),
          JSON.stringify(gate.reasons),
          JSON.stringify(gate.responses),
          gate.status,
        )
        .run();
      count += 1;
    }
  }

  return count;
}

export async function insertExtensionReport(
  env: Env,
  report: AdmissibilityReport,
  matterId?: string,
): Promise<string> {
  const id = stableId("extension", report.id, report.evidence_id);
  await env.DB.prepare(`
    INSERT INTO extension_reports (
      id,
      matter_id,
      evidence_id,
      report_json
    )
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      report_json = excluded.report_json
  `)
    .bind(
      id,
      matterId ?? null,
      report.evidence_id,
      JSON.stringify(report.extension_report),
    )
    .run();
  return id;
}

export async function insertEvidenceItem(env: Env, item: EvidenceItem): Promise<void> {
  await ensureMatterAndChargeRecords(env, item);
  await env.DB.prepare(`
    INSERT OR IGNORE INTO evidence_items (
      id,
      matter_id,
      title,
      source_type,
      source_path,
      timestamp,
      tendering_party,
      opposing_party,
      fact_asserted,
      fact_in_issue,
      purpose_of_tender_json,
      linked_charge_id,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      item.id,
      item.matter_id,
      item.title,
      item.source_type,
      item.source_path ?? null,
      item.timestamp ?? null,
      item.tendering_party ?? null,
      item.opposing_party ?? null,
      item.fact_asserted ?? null,
      item.fact_in_issue,
      JSON.stringify(item.purpose_of_tender),
      item.linked_charge_id ?? null,
      item.notes ?? null,
    )
    .run();
}

export async function insertReport(
  env: Env,
  report: AdmissibilityReport,
): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO admissibility_reports (
      id,
      evidence_id,
      classification,
      legal_effect_json,
      gate_results_json,
      final_status,
      voir_dire_required,
      advance_ruling_candidate,
      counsel_priority,
      missing_proof_json,
      extension_report_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      report.id,
      report.evidence_id,
      report.classification,
      JSON.stringify(report.legal_effect),
      JSON.stringify(report.gate_results),
      report.final_status,
      report.voir_dire_required ? 1 : 0,
      report.advance_ruling_candidate ? 1 : 0,
      report.counsel_priority,
      JSON.stringify(report.missing_proof_global),
      JSON.stringify(report.extension_report),
    )
    .run();
}

export async function persistAssessmentArtifacts(
  env: Env,
  item: EvidenceItem,
  report: AdmissibilityReport,
): Promise<{
  factId: string;
  ruleNodeIds: string[];
  objectionCount: number;
  extensionReportId: string;
}> {
  const factId = await upsertFactInIssue(env, item);
  const ruleNodeIds = await upsertRuleNodesFromReport(env, report);
  const objectionCount = await insertObjectionsFromReport(env, report);
  const extensionReportId = await insertExtensionReport(env, report, item.matter_id);

  return {
    factId,
    ruleNodeIds,
    objectionCount,
    extensionReportId,
  };
}

export async function writeLedger(
  env: Env,
  eventType: string,
  payload: unknown,
  matterId?: string,
  evidenceId?: string,
): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO ledger_entries (
      id,
      event_type,
      matter_id,
      evidence_id,
      payload_json
    )
    VALUES (?, ?, ?, ?, ?)
  `)
    .bind(
      crypto.randomUUID(),
      eventType,
      matterId ?? null,
      evidenceId ?? null,
      JSON.stringify(payload),
    )
    .run();
}

function parsePurpose(value: unknown): string[] {
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function listEvidenceItems(env: Env, limit = 200): Promise<EvidenceItem[]> {
  const result = await env.DB.prepare(`
    SELECT
      id,
      matter_id,
      title,
      source_type,
      source_path,
      timestamp,
      tendering_party,
      opposing_party,
      fact_asserted,
      fact_in_issue,
      purpose_of_tender_json,
      linked_charge_id,
      notes
    FROM evidence_items
    ORDER BY created_at DESC
    LIMIT ?
  `)
    .bind(limit)
    .all<Record<string, unknown>>();

  const rows = result.results ?? [];
  return rows.map((row) => ({
    id: String(row.id),
    matter_id: String(row.matter_id),
    title: String(row.title),
    source_type: String(row.source_type),
    source_path: row.source_path ? String(row.source_path) : undefined,
    timestamp: row.timestamp ? String(row.timestamp) : undefined,
    tendering_party: row.tendering_party ? String(row.tendering_party) : undefined,
    opposing_party: row.opposing_party ? String(row.opposing_party) : undefined,
    fact_asserted: row.fact_asserted ? String(row.fact_asserted) : undefined,
    fact_in_issue: String(row.fact_in_issue),
    purpose_of_tender: parsePurpose(row.purpose_of_tender_json),
    linked_charge_id: row.linked_charge_id ? String(row.linked_charge_id) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
  }));
}
