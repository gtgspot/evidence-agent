# Operational Guide: What a `nano` File Does and How It Applies to an AI Agent Backend

A “nano file” is not a special category of file.

`nano` is a terminal-based text editor. It creates or edits ordinary files. What the file does depends entirely on:

1. the file name;
2. the file extension;
3. the file contents;
4. the file location;
5. the program that later reads, loads, imports, sources, interprets, or executes it.

`nano` itself does not run programs, start agents, execute scripts, load APIs, activate backends, or configure systems by itself. It only writes text into files.

The operational rule is:

```text
nano edits files.
Interpreters run scripts.
Programs read configuration files.
The shell executes commands.
Services load configuration.
Agents consume structured instructions.
```

For an AI agent backend, `nano` is used to create and edit the files that define the agent’s configuration, environment, project metadata, execution scripts, and local operating instructions.

---

# 1. Files edited with `nano` that configure programs or processes

These files are not normally executed directly. They are read by another program.

## 1.1 `.env` — environment variables and secrets

Create or edit:

```bash
nano .env
```

Example for an Evidence Act agent backend:

```env
APP_NAME=evidence-act-agent
APP_ENV=local
APP_PORT=8080

OPENAI_API_KEY=insert_your_openai_api_key_here
ANTHROPIC_API_KEY=insert_your_anthropic_api_key_here

DATABASE_URL=sqlite:///./data/evidence_agent.db
VECTOR_STORE_PATH=./data/vector_store
CORPUS_PATH=./corpus/evidence_act_2008_vic/version_027_2024-03-25

DEFAULT_JURISDICTION=Victoria
DEFAULT_INSTRUMENT=Evidence Act 2008 (Vic)
DEFAULT_VERSION=027
DEFAULT_VERSION_DATE=2024-03-25

LOG_LEVEL=INFO
AUDIT_LEDGER_PATH=./ledger/evidence_agent_ledger.jsonl
```

The `.env` file is read by your Python app, Node app, Docker service, or agent runtime.

It should not usually be executed directly.

Incorrect:

```bash
./.env
```

Correct:

```bash
source .env
```

or allow the application to load it using a library such as `python-dotenv`.

---

## 1.2 `config.yaml` — structured application configuration

Create:

```bash
mkdir -p config
nano config/evidence_agent.yaml
```

Example:

```yaml
agent:
  name: evidence-act-agent
  mode: local
  jurisdiction: Victoria
  primary_instrument: Evidence Act 2008 (Vic)
  version: "027"
  version_date: "2024-03-25"

corpus:
  evidence_act:
    path: corpus/evidence_act_2008_vic/version_027_2024-03-25/evidence-act-2008-vic.txt
    highlighted_json: corpus/evidence_act_2008_vic/version_027_2024-03-25/evidence-act-2008-vic.highlighted.json
    source_status: uploaded_text
    checksum_required: true

modules:
  source_integrity: true
  evidence_intake: true
  relevance_gate: true
  hearsay_gate: true
  opinion_gate: true
  admissions_gate: true
  credibility_gate: true
  exclusion_gate: true
  proof_gate: true
  voir_dire_router: true
  extensibility_report: true

outputs:
  default_format: markdown
  include_assumptions: true
  include_missing_proof: true
  include_extension_points: true
  include_citations: true

guardrails:
  never_cite_without_source_text: true
  never_treat_policy_as_law_without_linked_authority: true
  never_treat_credibility_as_element_defeating_without_explanation: true
  separate_truth_purpose_from_non_hearsay_purpose: true
  separate_source_of_power_from_admissibility_consequence: true
```

This file configures the agent. It does not run the agent.

A Python program might later read it like this:

```bash
python3 app.py --config config/evidence_agent.yaml
```

---

## 1.3 `package.json` — Node.js project configuration

Create:

```bash
nano package.json
```

Example:

```json
{
  "name": "evidence-act-agent",
  "version": "0.1.0",
  "description": "Local AI evidence-law agent structured around the Evidence Act 2008 (Vic).",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "node --test",
    "lint": "echo \"Add linter later\""
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "yaml": "^2.5.0"
  },
  "devDependencies": {}
}
```

This file is read by `npm`.

It is not run directly.

Correct:

```bash
npm install
npm start
```

Incorrect:

```bash
./package.json
```

---

## 1.4 `pyproject.toml` — Python project configuration

Create:

```bash
nano pyproject.toml
```

Example:

```toml
[project]
name = "evidence-act-agent"
version = "0.1.0"
description = "Extensible AI admissibility engine structured around the Evidence Act 2008 (Vic)."
requires-python = ">=3.11"

dependencies = [
    "pydantic>=2.7.0",
    "python-dotenv>=1.0.1",
    "pyyaml>=6.0.1",
    "fastapi>=0.111.0",
    "uvicorn>=0.30.0",
    "networkx>=3.3",
    "chromadb>=0.5.0"
]

[project.scripts]
evidence-agent = "evidence_agent.cli:main"

[tool.ruff]
line-length = 100
```

This file is read by Python packaging tools such as `pip`, `uv`, `poetry`, or `hatch`.

Example:

```bash
pip install -e .
```

Then, if the script is correctly implemented:

```bash
evidence-agent assess --item E001
```

---

## 1.5 `~/.zshrc` — shell configuration

Edit:

```bash
nano ~/.zshrc
```

Example:

```bash
export EVIDENCE_AGENT_HOME="$HOME/evidence-act-agent"
export PATH="$EVIDENCE_AGENT_HOME/bin:$PATH"

alias ea='cd "$EVIDENCE_AGENT_HOME"'
alias ea-run='python3 app.py'
alias ea-assess='python3 assess_evidence.py'
alias ll='ls -la'
```

This file is read by your shell when a new terminal session starts.

To load changes immediately:

```bash
source ~/.zshrc
```

Do not treat this as an AI-agent file. It is shell configuration.

---

# 2. Files edited with `nano` that can be executed

A file can be run only if:

1. it contains executable instructions;
2. it is written in a language an interpreter understands;
3. it is invoked with the correct command; or
4. it has executable permissions and a valid shebang line.

Saving the file does not execute it.

---

## 2.1 Shell script

Create:

```bash
nano scripts/setup.sh
```

Inside:

```bash
#!/bin/bash
set -e

echo "Creating Evidence Act agent folder structure..."

mkdir -p corpus/evidence_act_2008_vic/version_027_2024-03-25
mkdir -p config
mkdir -p data
mkdir -p ledger
mkdir -p outputs/issue_maps
mkdir -p outputs/admissibility_tables
mkdir -p outputs/objection_schedules
mkdir -p outputs/voir_dire_outlines
mkdir -p outputs/counsel_memos
mkdir -p src/evidence_agent
mkdir -p tests

touch data/.gitkeep
touch ledger/.gitkeep

echo "Setup complete."
```

Run through the interpreter:

```bash
bash scripts/setup.sh
```

Or make it executable:

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

The command `nano scripts/setup.sh` only edits the file.

The command `bash scripts/setup.sh` runs it.

---

## 2.2 Python script

Create:

```bash
nano assess_evidence.py
```

Inside:

```python
from dataclasses import dataclass
from typing import list


@dataclass
class EvidenceItem:
    evidence_id: str
    title: str
    evidence_type: str
    fact_in_issue: str
    purpose: str


def assess_evidence(item: EvidenceItem) -> dict:
    return {
        "evidence_id": item.evidence_id,
        "title": item.title,
        "classification": item.evidence_type,
        "fact_in_issue": item.fact_in_issue,
        "purpose": item.purpose,
        "rules_triggered": [
            "Evidence Act 2008 (Vic) s 55",
            "Evidence Act 2008 (Vic) s 56",
            "Evidence Act 2008 (Vic) s 135",
            "Evidence Act 2008 (Vic) s 137",
            "Evidence Act 2008 (Vic) s 138"
        ],
        "status": "requires structured admissibility assessment",
        "extension_points": [
            "Add hearsay classifier",
            "Add opinion evidence classifier",
            "Add admissions module",
            "Add Road Safety Act source-of-power resolver",
            "Add voir dire router"
        ]
    }


if __name__ == "__main__":
    item = EvidenceItem(
        evidence_id="E001",
        title="BWC statement: licence is all good",
        evidence_type="audio_visual_recording_with_previous_representation",
        fact_in_issue="whether the accused was authorised to drive",
        purpose="credibility, state of investigation, and possible relevance to licence authorisation"
    )

    result = assess_evidence(item)

    for key, value in result.items():
        print(f"{key}: {value}")
```

Run:

```bash
python3 assess_evidence.py
```

This file is executable because Python can interpret it.

---

## 2.3 JavaScript / Node.js script

Create:

```bash
mkdir -p src
nano src/index.js
```

Inside:

```javascript
import "dotenv/config";

const agentName = process.env.APP_NAME || "evidence-act-agent";
const jurisdiction = process.env.DEFAULT_JURISDICTION || "Victoria";
const instrument = process.env.DEFAULT_INSTRUMENT || "Evidence Act 2008 (Vic)";

console.log(`Agent: ${agentName}`);
console.log(`Jurisdiction: ${jurisdiction}`);
console.log(`Primary instrument: ${instrument}`);
console.log("Status: local configuration loaded");
```

Run:

```bash
node src/index.js
```

Or through `package.json`:

```bash
npm start
```

---

## 2.4 Makefile command

Create:

```bash
nano Makefile
```

Inside:

```makefile
setup:
	bash scripts/setup.sh

run:
	python3 assess_evidence.py

show-config:
	cat config/evidence_agent.yaml

check:
	python3 --version
	ls -la
```

Run:

```bash
make setup
make run
make show-config
make check
```

The `Makefile` itself is not normally run directly. The `make` program reads it and runs the selected command.

---

# 3. Files edited with `nano` that are not directly executable

These files can be important, but they are not programs by themselves.

## 3.1 Plain text files

Examples:

```text
notes.txt
README.md
instructions.md
todo.txt
case_theory.md
issue_map.md
```

Create:

```bash
nano README.md
```

Inside:

```markdown
# Evidence Act Agent

This project is a local AI-assisted admissibility and objection engine structured around the Evidence Act 2008 (Vic).

It separates:

- evidence item classification;
- fact in issue;
- purpose of tender;
- admissibility pathway;
- objection;
- response;
- proof gap;
- voir dire trigger;
- extensibility report.
```

You can read this file. It does not execute.

---

## 3.2 Configuration files

These usually cannot be run directly:

```text
.env
config.yaml
settings.json
pyproject.toml
package.json
docker-compose.yml
.gitignore
```

They become operational only when another program reads them.

Examples:

```bash
docker compose up
```

reads:

```text
docker-compose.yml
```

```bash
npm start
```

reads:

```text
package.json
```

```bash
python3 app.py
```

may read:

```text
.env
config/evidence_agent.yaml
```

---

## 3.3 Invalid script files

If you create:

```bash
nano broken.py
```

Inside:

```text
this is not valid python
```

Then run:

```bash
python3 broken.py
```

Python will fail because the file is not valid Python syntax.

A file is not executable merely because it has `.py`, `.sh`, or `.js` at the end. The contents still have to be valid for the relevant interpreter.

---

## 3.4 Files without executable permission

This may fail:

```bash
./scripts/setup.sh
```

with:

```text
Permission denied
```

unless you first run:

```bash
chmod +x scripts/setup.sh
```

But you can still run the file through the interpreter:

```bash
bash scripts/setup.sh
```

Executable permission matters when you run a file directly as a program.

---

## 3.5 Binary programs cannot be created by typing ordinary text into `nano`

You cannot create real compiled programs simply by typing random text into `nano`.

Examples of installed executable programs:

```text
python3
node
git
docker
npm
make
sqlite3
```

These are actual executable binaries or installed command-line tools.

You do not create them like this:

```bash
nano /usr/bin/python3
```

That would be wrong and dangerous.

You install programs using package managers or official installers.

Examples:

```bash
brew install python
brew install node
brew install git
brew install sqlite
```

or use system-provided versions.

---

# 4. Practical setup for the Evidence Act agent project

Use this operational sequence.

## 4.1 Create the project folder

```bash
mkdir -p evidence-act-agent
cd evidence-act-agent
```

## 4.2 Create the directory structure

```bash
mkdir -p corpus/evidence_act_2008_vic/version_027_2024-03-25
mkdir -p config
mkdir -p data
mkdir -p ledger
mkdir -p scripts
mkdir -p src/evidence_agent
mkdir -p outputs/issue_maps
mkdir -p outputs/admissibility_tables
mkdir -p outputs/objection_schedules
mkdir -p outputs/voir_dire_outlines
mkdir -p outputs/counsel_memos
mkdir -p tests
```

## 4.3 Create `.gitignore`

```bash
nano .gitignore
```

Inside:

```gitignore
.env
*.log
__pycache__/
.venv/
data/
ledger/*.jsonl
.DS_Store
node_modules/
```

Purpose: tells Git what not to track.

It does not run.

---

## 4.4 Create `.env.example`

```bash
nano .env.example
```

Inside:

```env
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

LOG_LEVEL=INFO
AUDIT_LEDGER_PATH=./ledger/evidence_agent_ledger.jsonl
```

Then create your real `.env`:

```bash
cp .env.example .env
nano .env
```

Insert real API keys only into `.env`, not into `.env.example`.

---

## 4.5 Create the config file

```bash
nano config/evidence_agent.yaml
```

Inside:

```yaml
agent:
  name: evidence-act-agent
  purpose: "Extensible admissibility and objection engine for Evidence Act 2008 (Vic)"
  mode: local
  jurisdiction: Victoria

instrument:
  name: Evidence Act 2008 (Vic)
  version: "027"
  version_date: "2024-03-25"

principles:
  source_of_power_separate_from_admissibility: true
  evidence_item_must_be_classified_first: true
  fact_in_issue_required: true
  purpose_of_tender_required: true
  assumptions_must_be_flagged: true
  missing_proof_must_be_identified: true
  extensibility_report_required: true

enabled_modules:
  source_integrity: true
  evidence_intake: true
  purpose_splitter: true
  legal_effect_classifier: true
  relevance_gate: true
  hearsay_gate: true
  opinion_gate: true
  admissions_gate: true
  judgments_convictions_gate: true
  tendency_coincidence_gate: true
  credibility_gate: true
  character_gate: true
  identification_gate: true
  privilege_gate: true
  exclusion_gate: true
  proof_gate: true
  voir_dire_router: true
  advance_ruling_router: true
  extensibility_agent: true

output:
  format: markdown
  include_citations: true
  include_confidence: true
  include_assumptions: true
  include_missing_proof: true
  include_extension_points: true
```

---

## 4.6 Create the cluster registry

```bash
nano config/evidence_act_cluster_registry.yaml
```

Inside:

```yaml
instrument:
  name: Evidence Act 2008 (Vic)
  version: "027"
  effective_date: "2024-03-25"

clusters:
  - id: EA0
    name: Source integrity and version control
    sections: []
    function: "Ensure all reasoning is version-pinned and source-cited."
    extension_hooks:
      - official_legislation_sync
      - amendment_tracker
      - checksum_validator

  - id: EA1
    name: Application and jurisdiction
    sections: ["1", "2", "3", "3A", "4", "5", "6", "7", "8", "9", "10", "11"]
    function: "Determine whether the Act applies and whether another Act modifies its operation."
    extension_hooks:
      - proceeding_type_classifier
      - sentencing_direction_module
      - external_act_override_checker

  - id: EA2
    name: Witnesses and adducing evidence
    sections: ["12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "24A", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"]
    function: "Control how witness evidence is given, challenged, limited, revived, or recalled."
    extension_hooks:
      - cross_exam_generator
      - prior_inconsistent_statement_mapper
      - police_witness_reliability_module

  - id: EA3
    name: Documents and other evidence
    sections: ["47", "48", "49", "50", "51", "52", "53", "54"]
    function: "Handle document proof, contents, copies, views, and physical or non-documentary evidence."
    extension_hooks:
      - transcript_alignment
      - metadata_authentication
      - exhibit_bundle_builder

  - id: EA4
    name: Relevance
    sections: ["55", "56", "57", "58"]
    function: "Determine whether evidence rationally affects a fact in issue."
    extension_hooks:
      - fact_in_issue_graph
      - provisional_relevance_checker
      - inferential_link_mapper

  - id: EA5
    name: Hearsay
    sections: ["59", "60", "61", "62", "63", "64", "65", "66", "66A", "67", "68", "69", "70", "71", "72", "73", "74", "75"]
    function: "Determine whether a previous representation is excluded or saved by an exception."
    extension_hooks:
      - previous_representation_classifier
      - non_hearsay_purpose_splitter
      - business_record_checker
      - electronic_communication_checker

  - id: EA6
    name: Opinion
    sections: ["76", "77", "78", "78A", "79", "80"]
    function: "Determine whether opinion evidence is excluded or admissible by exception."
    extension_hooks:
      - officer_opinion_foundation_checker
      - expert_basis_mapper
      - specialised_knowledge_validator

  - id: EA7
    name: Admissions
    sections: ["81", "82", "83", "84", "85", "86", "87", "88", "89", "90"]
    function: "Assess admissions, reliability, records of questioning, silence, proof, and discretionary exclusion."
    extension_hooks:
      - caution_timing_checker
      - investigating_official_classifier
      - cross_matter_admission_risk

  - id: EA8
    name: Judgments and convictions
    sections: ["91", "92", "93"]
    function: "Control whether judgments and convictions may be used as evidence."
    extension_hooks:
      - prior_conviction_use_classifier
      - prohibited_reasoning_detector

  - id: EA9
    name: Tendency and coincidence
    sections: ["94", "95", "96", "97", "98", "99", "100", "101"]
    function: "Assess tendency, coincidence, notice, probative value, and prosecution restrictions."
    extension_hooks:
      - notice_checker
      - tendency_risk_classifier
      - unfair_prejudice_balancer

  - id: EA10
    name: Credibility
    sections: ["101A", "102", "103", "104", "105", "106", "107", "108", "108A", "108B", "108C"]
    function: "Assess credibility evidence, cross-examination, rebuttal, and specialised knowledge."
    extension_hooks:
      - officer_contradiction_mapper
      - metadata_impossibility_detector
      - reckless_false_representation_checker

  - id: EA11
    name: Character
    sections: ["109", "110", "111", "112"]
    function: "Assess character evidence about accused and co-accused."
    extension_hooks:
      - character_door_opening_checker
      - prosecution_rebuttal_risk

  - id: EA12
    name: Identification evidence
    sections: ["113", "114", "115", "116"]
    function: "Assess visual and picture identification evidence."
    extension_hooks:
      - image_identification_checker
      - licence_photo_identity_module

  - id: EA13
    name: Privileges
    sections: ["117", "118", "119", "120", "121", "122", "123", "124", "125", "126", "126J", "126K", "127", "128", "128A", "129", "130", "131", "131A", "132", "133", "134"]
    function: "Assess legal privilege, self-incrimination, religious confession, matters of state, settlement, and inadmissible evidence."
    extension_hooks:
      - subpoena_privilege_checker
      - confidential_communication_classifier
      - state_material_claim_checker

  - id: EA14
    name: Discretionary and mandatory exclusions
    sections: ["135", "136", "137", "138", "139"]
    function: "Exclude, limit, or contest evidence based on prejudice, unfairness, impropriety, illegality, or cautioning."
    extension_hooks:
      - source_of_power_resolver
      - charter_rights_mapper
      - s138_balance_calculator
      - caution_timing_checker

  - id: EA15
    name: Proof
    sections: ["140", "141", "142", "143", "144", "145", "146", "147", "148", "149", "150", "151", "152", "153", "154", "155", "155A", "156", "157", "158", "159", "160", "161", "162", "163", "164", "165", "165A", "165B", "166", "167", "168", "169", "170", "171", "172", "173", "174", "175", "176", "177", "178", "179", "180", "181"]
    function: "Assess proof standards, judicial notice, machine evidence, official records, affidavits, certificates, service, and proof mechanics."
    extension_hooks:
      - machine_output_validator
      - official_record_checker
      - certificate_proof_checker
      - service_proof_checker

  - id: EA16
    name: Miscellaneous, voir dire, waiver, agreements, advance rulings
    sections: ["182", "183", "184", "185", "186", "187", "188", "189", "190", "191", "192", "192A", "193", "194", "195", "196", "197"]
    function: "Handle preliminary questions, voir dire, waiver, agreed facts, advance rulings, and procedural powers."
    extension_hooks:
      - voir_dire_outline_generator
      - advance_ruling_request_generator
      - agreed_facts_builder
```

---

# 5. Clean operational rule

Use this distinction:

```text
nano creates or edits a file.
The file does nothing until something else uses it.
```

Examples:

```bash
nano .env
```

creates configuration.

```bash
python3 app.py
```

runs Python.

```bash
bash scripts/setup.sh
```

runs a shell script.

```bash
node src/index.js
```

runs JavaScript.

```bash
npm start
```

reads `package.json`.

```bash
docker compose up
```

reads `docker-compose.yml`.

```bash
source ~/.zshrc
```

loads shell configuration into the current shell.

```bash
make run
```

reads `Makefile` and executes the `run` command.

---

# 6. Practical safety checks before running any file

Before running a file, inspect it.

```bash
cat filename
```

or:

```bash
nano filename
```

Check file type:

```bash
file filename
```

Check permissions:

```bash
ls -la filename
```

Check script contents:

```bash
sed -n '1,120p' filename
```

Check whether it has a shebang:

```bash
head -n 1 filename
```

Example shebangs:

```bash
#!/bin/bash
```

```python
#!/usr/bin/env python3
```

If you do not understand what a file does, do not run it.

---

# 7. Operational summary

A file becomes operational only when some process does one of the following:

```text
reads it
sources it
interprets it
executes it
imports it
watches it
loads it as configuration
uses it as project metadata
uses it as a command definition
uses it as a service definition
```

For the Evidence Act agent backend:

```text
.env                       stores environment variables
config/evidence_agent.yaml configures the agent
pyproject.toml             configures the Python project
package.json               configures the Node project
Makefile                   defines repeatable commands
scripts/setup.sh           creates project folders
assess_evidence.py         runs a basic evidence assessment
README.md                  explains the project
.gitignore                 prevents sensitive or generated files being committed
```

The safe mental model is:

```text
nano edits.
bash runs shell scripts.
python3 runs Python scripts.
node runs JavaScript files.
npm reads package.json.
make reads Makefile.
docker reads Dockerfile or docker-compose.yml.
source loads shell configuration.
```

For your agent project, `nano` is the tool used to write the operating files. The backend only comes alive when those files are read or executed by the appropriate program.
