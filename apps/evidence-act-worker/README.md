# evidence-act-worker

Cloudflare Workers + React + Vite Evidence Life-Cycle Dashboard for Evidence Act 2008 (Vic) workflows.

## Binding to add first

In Cloudflare Dashboard:
1. Worker -> Settings -> Bindings -> Add binding
2. Select `D1 Database`
3. Binding name: `DB`
4. Database: `evidence_act_agent`

Then set `database_id` in [wrangler.toml](/Users/spot/evidence-agent/apps/evidence-act-worker/wrangler.toml).

## Local markdown asset folder

Use [file/assets](/Users/spot/evidence-agent/apps/evidence-act-worker/file/assets) for user-uploaded markdown reference files.

- Add `.md` references here before ingestion or mapping.
- The folder is tracked with `.gitkeep` so collaborators get the same structure.

Use [file/context](/Users/spot/evidence-agent/apps/evidence-act-worker/file/context) for context markdown files exposed via Worker APIs and the frontend context panel.

- Default file: `file/context/case_context.md`
- Worker endpoints:
`GET /api/context-file?name=case_context.md`
`POST /api/context-file`

## Official authority corpus ingestion

Official statutory text is now designed to be pulled directly from an app asset in R2 and parsed into D1.

1. Add an R2 binding named `EVIDENCE_FILES` in `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "EVIDENCE_FILES"
bucket_name = "evidence-act-files"
```

2. Upload authoritative text files to R2 (for example, Evidence Act 2008 (Vic), Road Safety Act, regulations, principles, rules).
3. Ingest by calling:

```bash
POST /api/authorities/ingest
```

with JSON:

```json
{
  "title": "Evidence Act 2008 (Vic)",
  "authority_kind": "act",
  "jurisdiction": "Victoria",
  "version": "027",
  "version_date": "2024-03-25",
  "source_uri": "r2://evidence-act-files/corpus/evidence-act-2008-vic.txt"
}
```

4. Query parsed corpus:
- `GET /api/authorities`
- `GET /api/authorities/sections?source_id=<id>&citation=s%2055`

## Semantic Retrieval (Vectorize + Workers AI)

The Worker now supports semantic authority retrieval with this runtime chain:

`R2 official text -> parser -> D1 authority tables -> Workers AI embeddings -> Vectorize index -> report enrichment`

Enable the optional bindings in `wrangler.toml`:

```toml
[ai]
binding = "AI"

[[vectorize]]
binding = "VECTOR_INDEX"
index_name = "evidence-authority-index"
```

Create the Vectorize index (once):

```bash
npx wrangler vectorize create evidence-authority-index --dimensions=768 --metric=cosine
```

Recommended vars:

```toml
VECTOR_NAMESPACE = "authority-corpus-v1"
VECTOR_EMBED_MODEL = "@cf/baai/bge-base-en-v1.5"
```

When both bindings are active, `/api/authorities/ingest` will auto-index chunk embeddings, and `/api/demo` + `/api/assess` will use semantic fallback matching when exact citation lookup misses.

## Local commands

```bash
npm install
npm run d1:migrate:local
npm run dev:api
npm run dev:web
npm run build:web
npm run deploy
```

`npm run deploy` builds the frontend and deploys the Worker with static assets from `frontend/dist`.

## Secrets

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put DASHBOARD_API_KEY
npx wrangler secret put CLAUDE_WEBHOOK_SECRET
```

Note: `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` are optional for downstream integrations. The semantic indexing path in this Worker uses Cloudflare Workers AI via the `AI` binding.

When `DASHBOARD_API_KEY` is set and `AUTH_REQUIRED = "true"` in `wrangler.toml`, dashboard API routes require `Authorization: Bearer <DASHBOARD_API_KEY>`.

## Claude webhook

Endpoint:

- `POST /api/webhooks/claude`

Security model:

- Shared secret via `CLAUDE_WEBHOOK_SECRET`
- Required headers:
`x-claude-timestamp`
`x-claude-signature`
- Signature format: HMAC SHA-256 over `${timestamp}.${raw_body}` (hex, `sha256=` prefix optional)
- Replay window: 300 seconds

Quick endpoint probe:

- `GET /api/webhooks/claude`
