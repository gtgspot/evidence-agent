import type { AdmissibilityReport, Env, GateResult } from "./types";

type ProvisionType =
  | "s"
  | "r"
  | "rule"
  | "principle"
  | "chapter"
  | "part"
  | "division"
  | "text";

interface ParsedSection {
  ordinal: number;
  provision_type: ProvisionType;
  citation: string;
  citation_norm: string;
  heading: string | null;
  body_text: string;
  canonical_ref: string;
}

interface AuthoritySourceRow {
  id: string;
  title: string;
  source_uri: string;
}

interface AuthoritySectionRow {
  id: string;
  source_id: string;
  citation: string;
  citation_norm: string;
  heading: string | null;
  body_text: string;
  canonical_ref: string;
  source_title: string;
  source_uri: string;
}

interface AuthorityChunkRow {
  chunk_id: string;
  source_id: string;
  section_id: string;
  citation: string;
  citation_norm: string;
  heading: string | null;
  body_text: string;
  chunk_text: string;
  canonical_ref: string;
  source_title: string;
  source_uri: string;
}

interface ChunkVectorCandidate {
  chunk_id: string;
  source_id: string;
  section_id: string;
  citation_norm: string;
  canonical_ref: string;
  title: string;
  authority_kind: string;
  heading: string | null;
  chunk_text: string;
}

const DEFAULT_VECTOR_NAMESPACE = "authority-corpus-v1";
const DEFAULT_VECTOR_EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";
const EMBEDDING_BATCH_SIZE = 24;
const VECTOR_MUTATION_BATCH_SIZE = 100;

export interface AuthorityIngestInput {
  title: string;
  authority_kind: string;
  jurisdiction?: string;
  version?: string;
  version_date?: string;
  citation?: string;
  source_uri: string;
  parser_version?: string;
}

export interface AuthorityIngestResult {
  source_id: string;
  title: string;
  source_uri: string;
  checksum: string;
  parser_version: string;
  section_count: number;
  chunk_count: number;
  link_count: number;
  vector_count: number;
  semantic_indexed: boolean;
}

export interface AuthoritySourceSummary {
  id: string;
  title: string;
  authority_kind: string;
  jurisdiction: string | null;
  version: string | null;
  version_date: string | null;
  source_uri: string;
  checksum: string | null;
  ingested_at: string;
  section_count: number;
  chunk_count: number;
}

export interface AuthoritySectionSummary {
  id: string;
  source_id: string;
  ordinal: number;
  provision_type: string;
  citation: string;
  heading: string | null;
  canonical_ref: string;
  excerpt: string;
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function vectorNamespace(env: Env): string {
  return env.VECTOR_NAMESPACE?.trim() || DEFAULT_VECTOR_NAMESPACE;
}

function vectorEmbedModel(env: Env): string {
  return env.VECTOR_EMBED_MODEL?.trim() || DEFAULT_VECTOR_EMBED_MODEL;
}

function hasSemanticBindings(env: Env): env is Env & { AI: NonNullable<Env["AI"]>; VECTOR_INDEX: NonNullable<Env["VECTOR_INDEX"]> } {
  return Boolean(env.AI && env.VECTOR_INDEX);
}

function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  if (batchSize <= 0) return [items];
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
}

function normalizeAnyCitation(value: string): string {
  const normalized = normalizeCitation(value);
  if (normalized) return normalized;
  return normalizeWhitespace(value).toLowerCase();
}

function buildChunkVectorText(candidate: ChunkVectorCandidate): string {
  const heading = candidate.heading ? `Heading: ${candidate.heading}` : "";
  return normalizeWhitespace(
    [
      `Authority: ${candidate.title}`,
      `Kind: ${candidate.authority_kind}`,
      `Provision: ${candidate.canonical_ref}`,
      heading,
      `Text: ${candidate.chunk_text}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function toVectorValues(value: unknown): number[][] {
  if (!value || typeof value !== "object") return [];
  const rows = (value as { data?: unknown }).data;
  if (!Array.isArray(rows)) return [];

  const vectors: number[][] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const converted = row.map((part) => Number(part)).filter((part) => Number.isFinite(part));
    if (converted.length > 0) vectors.push(converted);
  }
  return vectors;
}

async function embedTexts(env: Env, texts: string[]): Promise<number[][]> {
  if (!hasSemanticBindings(env)) return [];
  if (texts.length === 0) return [];

  const model = vectorEmbedModel(env);
  const vectors: number[][] = [];
  for (const batch of splitIntoBatches(texts, EMBEDDING_BATCH_SIZE)) {
    const output = await (env.AI as {
      run: (model: string, inputs: Record<string, unknown>) => Promise<unknown>;
    }).run(model, {
      text: batch,
      pooling: "cls",
    });
    const batchVectors = toVectorValues(output);
    if (batchVectors.length !== batch.length) {
      throw new Error("Embedding output size mismatch from Workers AI.");
    }
    vectors.push(...batchVectors);
  }
  return vectors;
}

async function removeSourceVectors(env: Env, sourceId: string): Promise<void> {
  if (!hasSemanticBindings(env)) return;
  const existing = await env.DB.prepare(`
    SELECT id
    FROM authority_chunks
    WHERE source_id = ?
  `)
    .bind(sourceId)
    .all<{ id: string }>();
  const ids = (existing.results ?? []).map((row) => row.id).filter(Boolean);
  if (ids.length === 0) return;

  for (const batch of splitIntoBatches(ids, VECTOR_MUTATION_BATCH_SIZE)) {
    await env.VECTOR_INDEX.deleteByIds(batch);
  }
}

async function upsertAuthorityChunkVectors(env: Env, candidates: ChunkVectorCandidate[]): Promise<number> {
  if (!hasSemanticBindings(env)) return 0;
  if (candidates.length === 0) return 0;

  const namespace = vectorNamespace(env);
  const vectorText = candidates.map((candidate) => buildChunkVectorText(candidate));
  const embeddings = await embedTexts(env, vectorText);
  if (embeddings.length !== candidates.length) {
    throw new Error("Unable to index authority chunks: embedding count mismatch.");
  }

  let vectorized = 0;
  for (const [batchIndex, candidateBatch] of splitIntoBatches(candidates, VECTOR_MUTATION_BATCH_SIZE).entries()) {
    const base = batchIndex * VECTOR_MUTATION_BATCH_SIZE;
    const vectors = candidateBatch.map((candidate, offset) => ({
      id: candidate.chunk_id,
      namespace,
      values: embeddings[base + offset],
      metadata: {
        source_id: candidate.source_id,
        section_id: candidate.section_id,
        chunk_id: candidate.chunk_id,
        citation_norm: candidate.citation_norm,
        canonical_ref: candidate.canonical_ref,
      },
    }));

    await env.VECTOR_INDEX.upsert(vectors);
    vectorized += vectors.length;
  }

  return vectorized;
}

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

function canonicalCitation(prefix: ProvisionType, value: string): string {
  const core = value.trim();
  if (prefix === "s" || prefix === "r") return `${prefix} ${core}`;
  return `${prefix} ${core}`.trim();
}

function normalizeCitation(value: string): string {
  const raw = value.toLowerCase().replace(/\s+/g, " ").trim();
  if (!raw) return raw;
  if (raw.startsWith("section ")) return `s ${raw.slice("section ".length).trim()}`;
  if (raw.startsWith("regulation ")) return `r ${raw.slice("regulation ".length).trim()}`;
  if (raw.startsWith("rule ")) return `rule ${raw.slice("rule ".length).trim()}`;
  if (raw.startsWith("principle ")) return `principle ${raw.slice("principle ".length).trim()}`;
  if (raw.startsWith("chapter ")) return `chapter ${raw.slice("chapter ".length).trim()}`;
  if (raw.startsWith("part ")) return `part ${raw.slice("part ".length).trim()}`;
  if (raw.startsWith("division ")) return `division ${raw.slice("division ".length).trim()}`;
  return raw;
}

function parseInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function expandCitationRange(prefix: "s" | "r", startRaw: string, endRaw: string): string[] {
  const start = startRaw.toLowerCase();
  const end = endRaw.toLowerCase();
  const startMatch = start.match(/^(\d+)([a-z]*)$/);
  const endMatch = end.match(/^(\d+)([a-z]*)$/);
  if (!startMatch || !endMatch) {
    return [normalizeCitation(`${prefix} ${start}`), normalizeCitation(`${prefix} ${end}`)];
  }

  if (startMatch[2] || endMatch[2]) {
    return [normalizeCitation(`${prefix} ${start}`), normalizeCitation(`${prefix} ${end}`)];
  }

  const startInt = parseInteger(startMatch[1]);
  const endInt = parseInteger(endMatch[1]);
  if (startInt === null || endInt === null || endInt < startInt || endInt - startInt > 40) {
    return [normalizeCitation(`${prefix} ${start}`), normalizeCitation(`${prefix} ${end}`)];
  }

  const values: string[] = [];
  for (let current = startInt; current <= endInt; current += 1) {
    values.push(normalizeCitation(`${prefix} ${current}`));
  }
  return values;
}

function extractCitationsFromText(text: string): string[] {
  const normalized = text.toLowerCase();
  const citations = new Set<string>();

  const rangePattern = /\b(ss|rr)\s+(\d+[a-z]?)(?:\s*-\s*(\d+[a-z]?))/gi;
  for (const match of normalized.matchAll(rangePattern)) {
    const prefix = match[1].startsWith("s") ? "s" : "r";
    const start = match[2];
    const end = match[3];
    if (!start || !end) continue;
    for (const citation of expandCitationRange(prefix, start, end)) {
      citations.add(citation);
    }
  }

  const singlePattern = /\b(s|section|r|regulation|rule|principle|chapter|part|division)\s+(\d+[a-z]?(?:\([^)]+\))?)/gi;
  for (const match of normalized.matchAll(singlePattern)) {
    const token = match[1];
    const value = match[2];
    if (!token || !value) continue;

    if (token === "s" || token === "section") citations.add(normalizeCitation(`s ${value}`));
    if (token === "r" || token === "regulation") citations.add(normalizeCitation(`r ${value}`));
    if (token === "rule") citations.add(normalizeCitation(`rule ${value}`));
    if (token === "principle") citations.add(normalizeCitation(`principle ${value}`));
    if (token === "chapter") citations.add(normalizeCitation(`chapter ${value}`));
    if (token === "part") citations.add(normalizeCitation(`part ${value}`));
    if (token === "division") citations.add(normalizeCitation(`division ${value}`));
  }

  return [...citations];
}

function detectHeading(line: string): { provisionType: ProvisionType; citation: string; heading: string | null } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const explicitMatchers: Array<{ pattern: RegExp; provisionType: ProvisionType }> = [
    { pattern: /^(?:s|section)\s+(\d+[a-z]?(?:\([^)]+\))*)\b[:\-.]?\s*(.*)$/i, provisionType: "s" },
    { pattern: /^(?:r|regulation)\s+(\d+[a-z]?(?:\([^)]+\))*)\b[:\-.]?\s*(.*)$/i, provisionType: "r" },
    { pattern: /^(?:rule)\s+(\d+[a-z]?(?:\([^)]+\))*)\b[:\-.]?\s*(.*)$/i, provisionType: "rule" },
    { pattern: /^(?:principle)\s+(\d+[a-z]?(?:\([^)]+\))*)\b[:\-.]?\s*(.*)$/i, provisionType: "principle" },
    { pattern: /^(?:chapter)\s+([a-z0-9]+)\b[:\-.]?\s*(.*)$/i, provisionType: "chapter" },
    { pattern: /^(?:part)\s+([a-z0-9]+)\b[:\-.]?\s*(.*)$/i, provisionType: "part" },
    { pattern: /^(?:division)\s+([a-z0-9]+)\b[:\-.]?\s*(.*)$/i, provisionType: "division" },
  ];

  for (const { pattern, provisionType } of explicitMatchers) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    const citation = canonicalCitation(provisionType, match[1]);
    const heading = match[2]?.trim() || null;
    return { provisionType, citation, heading };
  }

  const implicitSection = trimmed.match(/^(\d+[a-z]?(?:\([^)]+\))*)\s+([A-Z][^\n]{2,})$/);
  if (implicitSection) {
    const citation = canonicalCitation("s", implicitSection[1]);
    const heading = implicitSection[2]?.trim() || null;
    return { provisionType: "s", citation, heading };
  }

  return null;
}

function parseAuthoritySections(title: string, text: string): ParsedSection[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const sections: ParsedSection[] = [];
  let current:
    | {
      provisionType: ProvisionType;
      citation: string;
      heading: string | null;
      body: string[];
    }
    | null = null;

  function finalizeCurrent(): void {
    if (!current) return;
    const bodyText = normalizeWhitespace(current.body.join("\n"));
    const headingText = current.heading?.trim() || null;
    const finalBody = bodyText || headingText || "";
    if (!finalBody) {
      current = null;
      return;
    }

    const ordinal = sections.length + 1;
    const canonical_ref = `${title} ${current.citation}`.trim();
    sections.push({
      ordinal,
      provision_type: current.provisionType,
      citation: current.citation,
      citation_norm: normalizeCitation(current.citation),
      heading: headingText,
      body_text: finalBody,
      canonical_ref,
    });
    current = null;
  }

  for (const line of lines) {
    const heading = detectHeading(line);
    if (heading) {
      finalizeCurrent();
      current = {
        provisionType: heading.provisionType,
        citation: heading.citation,
        heading: heading.heading,
        body: [],
      };
      continue;
    }

    if (!current) continue;
    current.body.push(line);
  }
  finalizeCurrent();

  if (sections.length > 0) return sections;

  const fallbackBody = normalizeWhitespace(text);
  if (!fallbackBody) return [];
  return [
    {
      ordinal: 1,
      provision_type: "text",
      citation: "full text",
      citation_norm: "full text",
      heading: "Unstructured authority text",
      body_text: fallbackBody,
      canonical_ref: `${title} full text`,
    },
  ];
}

function chunkText(text: string, chunkSize = 1200, overlap = 150): string[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];
  if (normalized.length <= chunkSize) return [normalized];

  const safeOverlap = Math.min(Math.max(overlap, 0), Math.max(chunkSize - 100, 0));
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(0, end - safeOverlap);
  }

  return chunks;
}

function parseR2KeyFromUri(sourceUri: string): string {
  if (!sourceUri.toLowerCase().startsWith("r2://")) {
    throw new Error("source_uri must be an r2:// URI.");
  }

  const withoutScheme = sourceUri.slice(5);
  const slashIndex = withoutScheme.indexOf("/");
  if (slashIndex < 0) {
    throw new Error("source_uri must include bucket and key segments.");
  }

  const key = withoutScheme.slice(slashIndex + 1).replace(/^\/+/, "");
  if (!key) {
    throw new Error("source_uri must include a non-empty object key.");
  }
  return key;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function excerpt(text: string, maxLength = 360): string {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
}

function placeholders(count: number): string {
  return new Array(count).fill("?").join(", ");
}

export async function ingestAuthorityFromAsset(
  env: Env,
  input: AuthorityIngestInput,
): Promise<AuthorityIngestResult> {
  if (!env.EVIDENCE_FILES) {
    throw new Error("EVIDENCE_FILES binding is missing. Official authority text must be pulled from R2 assets.");
  }
  if (!input.title?.trim()) {
    throw new Error("title is required.");
  }
  if (!input.authority_kind?.trim()) {
    throw new Error("authority_kind is required.");
  }
  if (!input.source_uri?.trim()) {
    throw new Error("source_uri is required.");
  }

  const parserVersion = input.parser_version?.trim() || "authority-parser-v1";
  const key = parseR2KeyFromUri(input.source_uri.trim());
  const object = await env.EVIDENCE_FILES.get(key);
  if (!object) {
    throw new Error(`Authority asset not found in R2 for key: ${key}`);
  }

  const text = await object.text();
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    throw new Error("Authority asset is empty after normalization.");
  }

  const checksum = await sha256Hex(normalized);
  const sourceId = stableId(
    "auth",
    input.title,
    input.authority_kind,
    input.version ?? "current",
    input.version_date ?? "undated",
  );
  const slug = normalizeIdPart(`${input.title}-${input.authority_kind}-${input.version ?? "current"}`) || sourceId;
  const sections = parseAuthoritySections(input.title.trim(), normalized);

  await env.DB.prepare(`
    INSERT INTO authority_sources (
      id,
      slug,
      title,
      authority_kind,
      jurisdiction,
      version,
      version_date,
      citation,
      source_uri,
      source_type,
      checksum,
      parser_version,
      is_official
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      authority_kind = excluded.authority_kind,
      jurisdiction = excluded.jurisdiction,
      version = excluded.version,
      version_date = excluded.version_date,
      citation = excluded.citation,
      source_uri = excluded.source_uri,
      source_type = excluded.source_type,
      checksum = excluded.checksum,
      parser_version = excluded.parser_version,
      ingested_at = CURRENT_TIMESTAMP,
      is_official = excluded.is_official
  `)
    .bind(
      sourceId,
      slug,
      input.title.trim(),
      input.authority_kind.trim().toLowerCase(),
      input.jurisdiction?.trim() || null,
      input.version?.trim() || null,
      input.version_date?.trim() || null,
      input.citation?.trim() || null,
      input.source_uri.trim(),
      "r2_asset",
      checksum,
      parserVersion,
    )
    .run();

  await env.DB.prepare("DELETE FROM authority_links WHERE source_id = ?").bind(sourceId).run();
  await removeSourceVectors(env, sourceId).catch(() => undefined);
  await env.DB.prepare("DELETE FROM authority_chunks WHERE source_id = ?").bind(sourceId).run();
  await env.DB.prepare("DELETE FROM authority_sections WHERE source_id = ?").bind(sourceId).run();

  const sectionIdByCitation = new Map<string, string>();
  const vectorCandidates: ChunkVectorCandidate[] = [];
  let chunkCount = 0;

  for (const section of sections) {
    const sectionId = stableId("asec", sourceId, String(section.ordinal), section.citation);
    sectionIdByCitation.set(section.citation_norm, sectionId);

    await env.DB.prepare(`
      INSERT INTO authority_sections (
        id,
        source_id,
        ordinal,
        provision_type,
        citation,
        citation_norm,
        heading,
        body_text,
        canonical_ref
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        sectionId,
        sourceId,
        section.ordinal,
        section.provision_type,
        section.citation,
        section.citation_norm,
        section.heading,
        section.body_text,
        section.canonical_ref,
      )
      .run();

    const chunks = chunkText(section.body_text);
    for (const [chunkIndex, chunk] of chunks.entries()) {
      const chunkId = stableId("achunk", sectionId, String(chunkIndex));
      const tokenEstimate = Math.max(1, Math.round(chunk.length / 4));
      await env.DB.prepare(`
        INSERT INTO authority_chunks (
          id,
          source_id,
          section_id,
          chunk_index,
          chunk_text,
          token_estimate
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `)
        .bind(chunkId, sourceId, sectionId, chunkIndex, chunk, tokenEstimate)
        .run();

      vectorCandidates.push({
        chunk_id: chunkId,
        source_id: sourceId,
        section_id: sectionId,
        citation_norm: section.citation_norm,
        canonical_ref: section.canonical_ref,
        title: input.title.trim(),
        authority_kind: input.authority_kind.trim().toLowerCase(),
        heading: section.heading,
        chunk_text: chunk,
      });
      chunkCount += 1;
    }
  }

  let linkCount = 0;
  const dedupe = new Set<string>();
  for (const section of sections) {
    const fromSectionId = sectionIdByCitation.get(section.citation_norm);
    if (!fromSectionId) continue;

    const references = extractCitationsFromText(section.body_text);
    for (const mention of references) {
      const toSectionId = sectionIdByCitation.get(mention);
      if (!toSectionId || toSectionId === fromSectionId) continue;
      const keyRef = `${fromSectionId}|${toSectionId}|${mention}`;
      if (dedupe.has(keyRef)) continue;
      dedupe.add(keyRef);

      await env.DB.prepare(`
        INSERT OR IGNORE INTO authority_links (
          source_id,
          from_section_id,
          to_section_id,
          relation,
          mention_citation
        )
        VALUES (?, ?, ?, ?, ?)
      `)
        .bind(sourceId, fromSectionId, toSectionId, "references", mention)
        .run();
      linkCount += 1;
    }
  }

  const vectorCount = await upsertAuthorityChunkVectors(env, vectorCandidates).catch(() => 0);

  return {
    source_id: sourceId,
    title: input.title.trim(),
    source_uri: input.source_uri.trim(),
    checksum,
    parser_version: parserVersion,
    section_count: sections.length,
    chunk_count: chunkCount,
    link_count: linkCount,
    vector_count: vectorCount,
    semantic_indexed: hasSemanticBindings(env),
  };
}

export async function listAuthoritySources(env: Env, limit = 100): Promise<AuthoritySourceSummary[]> {
  const result = await env.DB.prepare(`
    SELECT
      src.id,
      src.title,
      src.authority_kind,
      src.jurisdiction,
      src.version,
      src.version_date,
      src.source_uri,
      src.checksum,
      src.ingested_at,
      (SELECT COUNT(*) FROM authority_sections sec WHERE sec.source_id = src.id) AS section_count,
      (SELECT COUNT(*) FROM authority_chunks ch WHERE ch.source_id = src.id) AS chunk_count
    FROM authority_sources src
    ORDER BY src.ingested_at DESC
    LIMIT ?
  `)
    .bind(limit)
    .all<Record<string, unknown>>();

  return (result.results ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    authority_kind: String(row.authority_kind),
    jurisdiction: row.jurisdiction ? String(row.jurisdiction) : null,
    version: row.version ? String(row.version) : null,
    version_date: row.version_date ? String(row.version_date) : null,
    source_uri: String(row.source_uri),
    checksum: row.checksum ? String(row.checksum) : null,
    ingested_at: String(row.ingested_at),
    section_count: Number(row.section_count ?? 0),
    chunk_count: Number(row.chunk_count ?? 0),
  }));
}

export async function listAuthoritySections(
  env: Env,
  sourceId: string,
  citation?: string,
  limit = 200,
): Promise<AuthoritySectionSummary[]> {
  const normalizedCitation = citation ? normalizeCitation(citation) : null;
  const sql = normalizedCitation
    ? `
      SELECT
        id,
        source_id,
        ordinal,
        provision_type,
        citation,
        heading,
        canonical_ref,
        body_text
      FROM authority_sections
      WHERE source_id = ? AND citation_norm = ?
      ORDER BY ordinal ASC
      LIMIT ?
    `
    : `
      SELECT
        id,
        source_id,
        ordinal,
        provision_type,
        citation,
        heading,
        canonical_ref,
        body_text
      FROM authority_sections
      WHERE source_id = ?
      ORDER BY ordinal ASC
      LIMIT ?
    `;

  const statement = env.DB.prepare(sql);
  const result = normalizedCitation
    ? await statement.bind(sourceId, normalizedCitation, limit).all<Record<string, unknown>>()
    : await statement.bind(sourceId, limit).all<Record<string, unknown>>();

  return (result.results ?? []).map((row) => ({
    id: String(row.id),
    source_id: String(row.source_id),
    ordinal: Number(row.ordinal ?? 0),
    provision_type: String(row.provision_type),
    citation: String(row.citation),
    heading: row.heading ? String(row.heading) : null,
    canonical_ref: String(row.canonical_ref),
    excerpt: excerpt(String(row.body_text ?? "")),
  }));
}

function extractGateCitations(gate: GateResult): string[] {
  const set = new Set<string>();
  for (const label of gate.triggered_sections) {
    for (const citation of extractCitationsFromText(label)) {
      set.add(normalizeAnyCitation(citation));
    }
  }
  return [...set];
}

async function loadPreferredSources(env: Env, preferredTitle?: string): Promise<AuthoritySourceRow[]> {
  if (preferredTitle?.trim()) {
    const exact = preferredTitle.trim();
    const like = `%${exact}%`;
    const result = await env.DB.prepare(`
      SELECT id, title, source_uri
      FROM authority_sources
      ORDER BY
        CASE
          WHEN lower(title) = lower(?) THEN 0
          WHEN lower(title) LIKE lower(?) THEN 1
          ELSE 2
        END,
        ingested_at DESC
      LIMIT 12
    `)
      .bind(exact, like)
      .all<AuthoritySourceRow>();
    return result.results ?? [];
  }

  const result = await env.DB.prepare(`
    SELECT id, title, source_uri
    FROM authority_sources
    ORDER BY ingested_at DESC
    LIMIT 12
  `).all<AuthoritySourceRow>();
  return result.results ?? [];
}

async function loadSectionsByCitation(
  env: Env,
  sourceIds: string[],
  citations: string[],
): Promise<AuthoritySectionRow[]> {
  if (sourceIds.length === 0 || citations.length === 0) return [];
  const sql = `
    SELECT
      sec.id,
      sec.source_id,
      sec.citation,
      sec.citation_norm,
      sec.heading,
      sec.body_text,
      sec.canonical_ref,
      src.title AS source_title,
      src.source_uri AS source_uri
    FROM authority_sections sec
    JOIN authority_sources src ON src.id = sec.source_id
    WHERE sec.source_id IN (${placeholders(sourceIds.length)})
      AND sec.citation_norm IN (${placeholders(citations.length)})
    ORDER BY sec.ordinal ASC
  `;
  const params = [...sourceIds, ...citations];
  const result = await env.DB.prepare(sql).bind(...params).all<AuthoritySectionRow>();
  return result.results ?? [];
}

async function loadChunksByIds(env: Env, chunkIds: string[]): Promise<AuthorityChunkRow[]> {
  if (chunkIds.length === 0) return [];
  const sql = `
    SELECT
      ch.id AS chunk_id,
      ch.source_id,
      ch.section_id,
      sec.citation,
      sec.citation_norm,
      sec.heading,
      sec.body_text,
      ch.chunk_text,
      sec.canonical_ref,
      src.title AS source_title,
      src.source_uri AS source_uri
    FROM authority_chunks ch
    JOIN authority_sections sec ON sec.id = ch.section_id
    JOIN authority_sources src ON src.id = ch.source_id
    WHERE ch.id IN (${placeholders(chunkIds.length)})
  `;
  const result = await env.DB.prepare(sql).bind(...chunkIds).all<AuthorityChunkRow>();
  return result.results ?? [];
}

async function loadSemanticMatchesByCitation(
  env: Env,
  citations: string[],
): Promise<Map<string, AuthorityChunkRow>> {
  const matchByCitation = new Map<string, AuthorityChunkRow>();
  if (!hasSemanticBindings(env)) return matchByCitation;
  if (citations.length === 0) return matchByCitation;

  const queryTexts = citations.map((citation) => `Find statutory provision matching citation ${citation}.`);
  const queryEmbeddings = await embedTexts(env, queryTexts);
  if (queryEmbeddings.length !== citations.length) return matchByCitation;

  const namespace = vectorNamespace(env);
  const chunkIdByCitation = new Map<string, string>();
  for (const [index, citation] of citations.entries()) {
    const matches = await env.VECTOR_INDEX.query(queryEmbeddings[index], {
      topK: 4,
      namespace,
      returnMetadata: "indexed",
      returnValues: false,
    });
    const best = matches.matches?.[0];
    if (!best) continue;

    const metadata = (best.metadata ?? {}) as Record<string, unknown>;
    const metadataChunkId = typeof metadata.chunk_id === "string" ? metadata.chunk_id : null;
    const chunkId = metadataChunkId || best.id;
    if (!chunkId) continue;
    chunkIdByCitation.set(citation, chunkId);
  }

  const uniqueChunkIds = [...new Set(chunkIdByCitation.values())];
  if (uniqueChunkIds.length === 0) return matchByCitation;

  const rows = await loadChunksByIds(env, uniqueChunkIds);
  const rowByChunkId = new Map(rows.map((row) => [row.chunk_id, row]));
  for (const [citation, chunkId] of chunkIdByCitation.entries()) {
    const row = rowByChunkId.get(chunkId);
    if (row) matchByCitation.set(citation, row);
  }

  return matchByCitation;
}

export async function enrichReportWithAuthorities(
  env: Env,
  report: AdmissibilityReport,
  preferredTitle?: string,
): Promise<AdmissibilityReport> {
  const gateCitationMap = report.gate_results.map((gate) => extractGateCitations(gate));
  const allCitations = [...new Set(gateCitationMap.flat())];

  if (allCitations.length === 0) {
    return {
      ...report,
      authority_coverage: {
        retrieval_mode: hasSemanticBindings(env) ? "asset_corpus_index+vectorize" : "asset_corpus_index",
        requested_citations: 0,
        matched_citations: 0,
        unmatched_citations: [],
        source_titles: [],
      },
    };
  }

  const sources = await loadPreferredSources(env, preferredTitle);
  if (sources.length === 0) {
    return {
      ...report,
      authority_coverage: {
        retrieval_mode: hasSemanticBindings(env) ? "asset_corpus_index+vectorize" : "asset_corpus_index",
        requested_citations: allCitations.length,
        matched_citations: 0,
        unmatched_citations: allCitations,
        source_titles: [],
      },
    };
  }

  const sourceIds = sources.map((source) => source.id);
  const sections = await loadSectionsByCitation(env, sourceIds, allCitations);
  const sourceRank = new Map<string, number>();
  for (const [index, source] of sources.entries()) sourceRank.set(source.id, index);

  const bestMatchByCitation = new Map<string, AuthoritySectionRow>();
  for (const row of sections) {
    const existing = bestMatchByCitation.get(row.citation_norm);
    if (!existing) {
      bestMatchByCitation.set(row.citation_norm, row);
      continue;
    }

    const existingRank = sourceRank.get(existing.source_id) ?? Number.MAX_SAFE_INTEGER;
    const nextRank = sourceRank.get(row.source_id) ?? Number.MAX_SAFE_INTEGER;
    if (nextRank < existingRank) {
      bestMatchByCitation.set(row.citation_norm, row);
    }
  }

  const citationsNeedingSemantic = allCitations.filter((citation) => !bestMatchByCitation.has(citation));
  const semanticMatches = await loadSemanticMatchesByCitation(env, citationsNeedingSemantic).catch(() => new Map<string, AuthorityChunkRow>());

  const unmatched = new Set(allCitations);
  const sourceTitlesUsed = new Set<string>();

  const enrichedGates = report.gate_results.map((gate, index) => {
    const citations = gateCitationMap[index];
    const matches = citations
      .map((citation) => {
        const exact = bestMatchByCitation.get(citation);
        if (exact) {
          unmatched.delete(citation);
          sourceTitlesUsed.add(exact.source_title);
          return {
            citation: exact.citation,
            canonical_ref: exact.canonical_ref,
            source_title: exact.source_title,
            source_uri: exact.source_uri,
            heading: exact.heading,
            excerpt: excerpt(exact.body_text, 460),
          };
        }

        const semantic = semanticMatches.get(citation);
        if (!semantic) return null;
        unmatched.delete(citation);
        sourceTitlesUsed.add(semantic.source_title);
        return {
          citation: `${citation} (semantic)`,
          canonical_ref: semantic.canonical_ref,
          source_title: semantic.source_title,
          source_uri: semantic.source_uri,
          heading: semantic.heading,
          excerpt: excerpt(semantic.chunk_text, 460),
        };
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value));

    return {
      ...gate,
      authority_matches: matches,
    };
  });

  return {
    ...report,
    gate_results: enrichedGates,
    authority_coverage: {
      retrieval_mode: hasSemanticBindings(env) ? "asset_corpus_index+vectorize" : "asset_corpus_index",
      requested_citations: allCitations.length,
      matched_citations: allCitations.length - unmatched.size,
      unmatched_citations: [...unmatched],
      source_titles: [...sourceTitlesUsed],
    },
  };
}
