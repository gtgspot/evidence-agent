import { assessEvidence } from "./assessment";
import { healthMetrics, insertEvidenceItem, insertReport, listEvidenceItems, persistAssessmentArtifacts, probeDatabase, upsertFactInIssue, writeLedger } from "./db";
import type { Env, EvidenceItem, HealthPayload } from "./types";
import { enrichReportWithAuthorities, ingestAuthorityFromAsset, listAuthoritySections, listAuthoritySources } from "./authorities";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function html(markup: string, status = 200): Response {
  return new Response(markup, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

function authRequired(env: Env): boolean {
  const authToggle = (env.AUTH_REQUIRED ?? "true").toLowerCase() !== "false";
  const hasSecret = Boolean(env.DASHBOARD_API_KEY?.trim());
  return authToggle && hasSecret;
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim();
}

function isAuthorized(request: Request, env: Env): boolean {
  if (!authRequired(env)) return true;
  const token = extractBearerToken(request);
  return token === env.DASHBOARD_API_KEY;
}

function isPublicPath(pathname: string): boolean {
  return pathname === "/api/health" || pathname === "/api/demo" || pathname === "/api/auth/status" || pathname === "/api/auth/session";
}

function demoEvidenceItem(): EvidenceItem {
  return {
    id: "E-BWC-0949-LICENCE",
    matter_id: "R10165672",
    title: "BWC statement: officer says licence is all good",
    source_type: "body_worn_camera",
    timestamp: "09:49:00",
    tendering_party: "defence",
    opposing_party: "prosecution",
    fact_asserted: "Officer stated licence was all good",
    fact_in_issue: "whether the accused was authorised to drive",
    purpose_of_tender: [
      "credibility",
      "state_of_investigation",
      "admissibility",
    ],
    linked_charge_id: "C1",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      const d1Probe = await probeDatabase(env);
      const metrics = await healthMetrics(env);
      const payload: HealthPayload = {
        ok: true,
        app: env.APP_NAME,
        environment: env.APP_ENV ?? "unknown",
        instrument: env.DEFAULT_INSTRUMENT,
        version: env.DEFAULT_VERSION,
        version_date: env.DEFAULT_VERSION_DATE,
        bindings: {
          r2_bound: Boolean(env.EVIDENCE_FILES),
          ai_bound: Boolean(env.AI),
          vectorize_bound: Boolean(env.VECTOR_INDEX),
          vector_namespace: env.VECTOR_NAMESPACE?.trim() || "authority-corpus-v1",
          vector_embed_model: env.VECTOR_EMBED_MODEL?.trim() || "@cf/baai/bge-base-en-v1.5",
        },
        d1: d1Probe,
        metrics,
      };

      return json(payload);
    }

    if (url.pathname === "/api/auth/status" && request.method === "GET") {
      return json({
        ok: true,
        auth_required: authRequired(env),
        r2_bound: Boolean(env.EVIDENCE_FILES),
      });
    }

    if (url.pathname === "/api/auth/session" && request.method === "POST") {
      if (!authRequired(env)) {
        return json({ ok: true, auth_required: false, r2_bound: Boolean(env.EVIDENCE_FILES) });
      }

      let apiKey = extractBearerToken(request);
      if (!apiKey) {
        try {
          const payload = await readJson<{ apiKey?: string }>(request);
          apiKey = payload.apiKey?.trim() ?? null;
        } catch {
          apiKey = null;
        }
      }

      if (apiKey && apiKey === env.DASHBOARD_API_KEY) {
        return json({ ok: true, auth_required: true, r2_bound: Boolean(env.EVIDENCE_FILES) });
      }

      return json(
        {
          ok: false,
          error: "unauthorized",
          message: "Valid bearer token required.",
        },
        401,
      );
    }

    if (url.pathname.startsWith("/api") && !isPublicPath(url.pathname) && !isAuthorized(request, env)) {
      return json(
        {
          error: "unauthorized",
          message: "Valid bearer token required.",
        },
        401,
      );
    }

    if (url.pathname === "/api/demo" && request.method === "GET") {
      const item = demoEvidenceItem();
      const report = await enrichReportWithAuthorities(
        env,
        assessEvidence(item),
        env.DEFAULT_INSTRUMENT,
      );

      return json({
        item,
        report,
      });
    }

    if (url.pathname === "/api/evidence" && request.method === "POST") {
      const item = await readJson<EvidenceItem>(request);

      await insertEvidenceItem(env, item);
      const factId = await upsertFactInIssue(env, item);
      await writeLedger(env, "evidence_item_inserted", item, item.matter_id, item.id);
      await writeLedger(env, "fact_in_issue_upserted", { fact_id: factId, issue: item.fact_in_issue }, item.matter_id, item.id);

      return json({
        ok: true,
        item,
      });
    }

    if (url.pathname === "/api/evidence" && request.method === "GET") {
      const items = await listEvidenceItems(env, 300);
      return json({ items });
    }

    if (url.pathname === "/api/assess" && request.method === "POST") {
      const item = await readJson<EvidenceItem>(request);
      const report = await enrichReportWithAuthorities(
        env,
        assessEvidence(item),
        env.DEFAULT_INSTRUMENT,
      );

      await insertEvidenceItem(env, item).catch(() => undefined);
      await insertReport(env, report);
      const persisted = await persistAssessmentArtifacts(env, item, report);
      await writeLedger(env, "admissibility_assessment", report, item.matter_id, item.id);
      await writeLedger(
        env,
        "assessment_artifacts_persisted",
        {
          fact_id: persisted.factId,
          rule_node_ids: persisted.ruleNodeIds,
          objection_count: persisted.objectionCount,
          extension_report_id: persisted.extensionReportId,
        },
        item.matter_id,
        item.id,
      );

      return json(report);
    }

    if (url.pathname === "/api/authorities" && request.method === "GET") {
      const limitParam = url.searchParams.get("limit");
      const limit = Number.parseInt(limitParam ?? "100", 10);
      const sources = await listAuthoritySources(env, Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 100);
      return json({ sources });
    }

    if (url.pathname === "/api/authorities/sections" && request.method === "GET") {
      const sourceId = url.searchParams.get("source_id");
      if (!sourceId) {
        return json({ error: "bad_request", message: "source_id query parameter is required." }, 400);
      }
      const citation = url.searchParams.get("citation") ?? undefined;
      const limitParam = url.searchParams.get("limit");
      const limit = Number.parseInt(limitParam ?? "200", 10);
      const sections = await listAuthoritySections(
        env,
        sourceId,
        citation,
        Number.isFinite(limit) ? Math.max(1, Math.min(limit, 1000)) : 200,
      );
      return json({ sections });
    }

    if (url.pathname === "/api/authorities/ingest" && request.method === "POST") {
      try {
        const payload = await readJson<{
          title: string;
          authority_kind: string;
          jurisdiction?: string;
          version?: string;
          version_date?: string;
          citation?: string;
          source_uri: string;
          parser_version?: string;
        }>(request);

        const result = await ingestAuthorityFromAsset(env, payload);
        await writeLedger(env, "authority_ingested", result);
        return json({ ok: true, result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Authority ingest failed.";
        return json({ ok: false, error: "ingest_failed", message }, 400);
      }
    }

    if (url.pathname === "/api/ledger" && request.method === "GET") {
      const result = await env.DB.prepare(`
        SELECT *
        FROM ledger_entries
        ORDER BY created_at DESC
        LIMIT 50
      `).all();

      return json(result.results);
    }

    if (url.pathname.startsWith("/api")) {
      return json(
        {
          error: "not_found",
          available_routes: [
            "GET /api/health",
            "GET /api/demo",
            "POST /api/evidence",
            "POST /api/assess",
            "GET /api/ledger",
            "GET /api/auth/status",
            "POST /api/auth/session",
            "GET /api/evidence",
            "GET /api/authorities",
            "GET /api/authorities/sections",
            "POST /api/authorities/ingest",
          ],
        },
        404,
      );
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/") {
      return html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Evidence Life-Cycle Dashboard</title>
  </head>
  <body>
    <h1>Evidence Life-Cycle Dashboard</h1>
    <p>Evidence Act 2008 (Vic) admissibility and proof runtime.</p>
    <section id="health">Loading health status...</section>
    <section id="intake">Evidence intake ready.</section>
    <section id="results">Assessment results will appear here.</section>
  </body>
</html>`);
    }

    return json({ error: "not_found" }, 404);
  },
};
