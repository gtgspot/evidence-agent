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

## Wrapper

```bash
./evidence-agent.sh compile --source . --output build/evidence_bundle.json
```

The previous operational guide content was preserved at `docs/nano-operational-guide.md`.
