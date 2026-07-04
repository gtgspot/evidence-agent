#!/bin/bash
set -euo pipefail

PROJECT_NAME="evidence-act-agent"

echo "Creating $PROJECT_NAME..."

mkdir -p "$PROJECT_NAME"
cd "$PROJECT_NAME"

mkdir -p config
mkdir -p corpus/evidence_act_2008_vic/version_027_2024-03-25
mkdir -p matter/R10165672
mkdir -p source_vault/{bwc,dashcam,cad,leap,certificates,disclosure,correspondence,statutes,regulations,cases}
mkdir -p src/evidence_agent
mkdir -p ledger
mkdir -p outputs/{admissibility_reports,objection_schedules,voir_dire_outlines,advance_rulings,cross_exam,counsel_memos,extension_reports}
mkdir -p tests

touch src/evidence_agent/__init__.py
touch ledger/evidence_agent_ledger.jsonl

cat > .gitignore <<'EOF'
.env
.venv/
__pycache__/
*.pyc
.DS_Store
data/
ledger/*.jsonl
outputs/
node_modules/
EOF

cat > .env.example <<'EOF'
APP_NAME=evidence-act-agent
APP_ENV=local
APP_PORT=8080
OPENAI_API_KEY=insert_key_here
ANTHROPIC_API_KEY=insert_key_here
DATABASE_URL=sqlite:///./data/evidence_agent.db
VECTOR_STORE_PATH=./data/vector_store
CORPUS_PATH=./corpus/evidence_act_2008_vic/version_027_2024-03-25
DEFAULT_JURISDICTION=Victoria
DEFAULT_INSTRUMENT=Evidence Act 2008 (Vic)
DEFAULT_VERSION=027
DEFAULT_VERSION_DATE=2024-03-25
AUDIT_LEDGER_PATH=./ledger/evidence_agent_ledger.jsonl
EOF

cat > pyproject.toml <<'EOF'
[project]
name = "evidence-act-agent"
version = "0.1.0"
description = "Extensible Evidence Act 2008 (Vic) admissibility and proof runtime."
requires-python = ">=3.11"
dependencies = [
  "pydantic>=2.7.0",
  "python-dotenv>=1.0.1",
  "pyyaml>=6.0.1",
  "networkx>=3.3"
]

[project.scripts]
evidence-agent = "evidence_agent.cli:main"
EOF

cat > Makefile <<'EOF'
setup:
	pip install -e .

run:
	python3 -m evidence_agent.cli

tree:
	find . -maxdepth 3 -type d | sort

ledger:
	tail -n 20 ledger/evidence_agent_ledger.jsonl
EOF

echo "Bootstrap complete."
echo "Next:"
echo "  cd $PROJECT_NAME"
echo "  cp .env.example .env"
echo "  nano .env"
echo "  pip install -e ."

