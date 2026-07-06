# evidence-agent

Compile a local evidence manifest generator for legal-material bundles.

## Build

```bash
make compile
```

This creates an executable at `dist/evidence-agent`.

## Usage

```bash
./dist/evidence-agent compile --source /evidence-agent --output /evidence-agent/build/evidence_bundle.json
```

If `/evidence-agent` does not exist on your system, point `--source` to your actual folder path.

## Ingest a repository into a matter database

Register every file in a folder (a repo, a disclosure bundle, a brief) as an
Original artefact with a sha256 hash and an `ingested` chain-of-custody event:

```bash
./dist/evidence-agent ingest --db matter.db --matter M1 --source .
```

- Initialises the matter DB schema automatically if the DB is new.
- Idempotent: re-running skips files already registered (same path and hash),
  so only newly added files register on subsequent runs.
- `--source-label` overrides the provenance label (default: source dir name);
  `--actor` sets the custody-event actor; `--include-hidden` includes dotfiles.

Then inspect or check the register:

```bash
./dist/evidence-agent manifest --db matter.db --matter M1
./dist/evidence-agent verify --db matter.db --matter M1
```

## Wrapper

```bash
./evidence-agent.sh compile --source . --output build/evidence_bundle.json
```

The previous operational guide content was preserved at `docs/nano-operational-guide.md`.
