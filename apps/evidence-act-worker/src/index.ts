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

const CLAUDE_WEBHOOK_TTL_SECONDS = 300;

function normalizeWebhookSignature(value: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("sha256=")) {
    return trimmed.slice("sha256=".length).trim().toLowerCase();
  }
  return trimmed.toLowerCase();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function parseTimestampSeconds(headerValue: string | null): number | null {
  if (!headerValue?.trim()) return null;
  const raw = headerValue.trim();

  if (/^\d+$/.test(raw)) {
    const numeric = Number.parseInt(raw, 10);
    if (!Number.isFinite(numeric)) return null;
    if (numeric > 1_000_000_000_000) return Math.floor(numeric / 1000);
    return numeric;
  }

  const parsedMs = Date.parse(raw);
  if (!Number.isFinite(parsedMs)) return null;
  return Math.floor(parsedMs / 1000);
}

function isFreshWebhookTimestamp(headerValue: string | null): boolean {
  const timestamp = parseTimestampSeconds(headerValue);
  if (timestamp === null) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - timestamp) <= CLAUDE_WEBHOOK_TTL_SECONDS;
}

async function computeWebhookSignature(secret: string, timestamp: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const message = `${timestamp}.${rawBody}`;
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(digest)]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
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
  return pathname === "/api/health"
    || pathname === "/api/demo"
    || pathname === "/api/auth/status"
    || pathname === "/api/auth/session"
    || pathname === "/api/webhooks/claude";
}

function normalizeContextFileName(value: string | null): string {
  const fallback = "case_context.md";
  const raw = value?.trim() || fallback;
  const safe = raw.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return safe || fallback;
}

function contextFileId(name: string): string {
  const core = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `ctx-${core || "default"}`;
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

    if (url.pathname === "/api/webhooks/claude" && request.method === "GET") {
      return json({
        ok: true,
        route: "/api/webhooks/claude",
        signature_required: true,
        signature_header: "x-claude-signature",
        timestamp_header: "x-claude-timestamp",
        ttl_seconds: CLAUDE_WEBHOOK_TTL_SECONDS,
      });
    }

    if (url.pathname === "/api/webhooks/claude" && request.method === "POST") {
      const webhookSecret = env.CLAUDE_WEBHOOK_SECRET?.trim();
      if (!webhookSecret) {
        return json(
          {
            ok: false,
            error: "misconfigured",
            message: "CLAUDE_WEBHOOK_SECRET is not configured.",
          },
          503,
        );
      }

      const timestampHeader = request.headers.get("x-claude-timestamp")
        ?? request.headers.get("x-signature-timestamp");
      const signatureHeader = request.headers.get("x-claude-signature")
        ?? request.headers.get("x-signature");

      if (!timestampHeader || !signatureHeader) {
        return json(
          {
            ok: false,
            error: "unauthorized",
            message: "Missing webhook signature headers.",
          },
          401,
        );
      }

      if (!isFreshWebhookTimestamp(timestampHeader)) {
        return json(
          {
            ok: false,
            error: "unauthorized",
            message: "Webhook timestamp is invalid or stale.",
          },
          401,
        );
      }

      const rawBody = await request.text();
      const expected = await computeWebhookSignature(webhookSecret, timestampHeader, rawBody);
      const received = normalizeWebhookSignature(signatureHeader);
      if (!timingSafeEqual(received, expected)) {
        return json(
          {
            ok: false,
            error: "unauthorized",
            message: "Webhook signature verification failed.",
          },
          401,
        );
      }

      let payload: unknown = null;
      let jsonValid = true;
      try {
        payload = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        jsonValid = false;
        payload = { raw_body: rawBody };
      }

      const eventId = request.headers.get("x-claude-event-id")
        ?? request.headers.get("x-request-id")
        ?? crypto.randomUUID();
      const eventType = payload && typeof payload === "object" && "type" in payload
        ? String((payload as { type?: unknown }).type ?? "unknown")
        : "unknown";

      await writeLedger(env, "claude_webhook_received", {
        event_id: eventId,
        event_type: eventType,
        received_at: new Date().toISOString(),
        json_valid: jsonValid,
        payload,
      });

      if (
        payload
        && typeof payload === "object"
        && "challenge" in payload
        && typeof (payload as { challenge?: unknown }).challenge === "string"
      ) {
        return json({
          ok: true,
          challenge: (payload as { challenge: string }).challenge,
        });
      }

      return json({ ok: true, received: true, event_id: eventId, event_type: eventType });
    }

    if (url.pathname === "/api/context-file" && request.method === "GET") {
      const name = normalizeContextFileName(url.searchParams.get("name"));
      const row = await env.DB.prepare(`
        SELECT id, name, content_text, source_path, created_at, updated_at
        FROM context_files
        WHERE name = ?
        LIMIT 1
      `)
        .bind(name)
        .first<{
          id: string;
          name: string;
          content_text: string;
          source_path: string | null;
          created_at: string;
          updated_at: string;
        }>();

      if (!row) {
        return json({
          ok: true,
          exists: false,
          file: {
            id: contextFileId(name),
            name,
            content_text: "",
            source_path: `file/context/${name}`,
            created_at: null,
            updated_at: null,
          },
        });
      }

      return json({ ok: true, exists: true, file: row });
    }

    if (url.pathname === "/api/context-file" && request.method === "POST") {
      const payload = await readJson<{
        name?: string;
        content?: string;
        source_path?: string;
      }>(request);

      const name = normalizeContextFileName(payload.name ?? null);
      const content = (payload.content ?? "").toString();
      const sourcePath = payload.source_path?.trim() || `file/context/${name}`;
      if (content.length > 250_000) {
        return json(
          {
            ok: false,
            error: "bad_request",
            message: "Context file content is too large (max 250000 chars).",
          },
          400,
        );
      }

      const id = contextFileId(name);
      await env.DB.prepare(`
        INSERT INTO context_files (
          id,
          name,
          content_text,
          source_path
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          content_text = excluded.content_text,
          source_path = excluded.source_path,
          updated_at = CURRENT_TIMESTAMP
      `)
        .bind(id, name, content, sourcePath)
        .run();

      const saved = await env.DB.prepare(`
        SELECT id, name, content_text, source_path, created_at, updated_at
        FROM context_files
        WHERE name = ?
        LIMIT 1
      `)
        .bind(name)
        .first<{
          id: string;
          name: string;
          content_text: string;
          source_path: string | null;
          created_at: string;
          updated_at: string;
        }>();

      await writeLedger(env, "context_file_upserted", {
        id,
        name,
        source_path: sourcePath,
        content_length: content.length,
      });

      return json({ ok: true, file: saved });
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
            "GET /api/webhooks/claude",
            "POST /api/webhooks/claude",
            "GET /api/context-file",
            "POST /api/context-file",
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
