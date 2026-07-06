#!/usr/bin/env python3
"""Compile evidence directories into a deterministic manifest."""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Iterable

from evidence_agent.core import add_artefact, db, list_artefacts, ArtefactClass
from evidence_agent.core.hashing import sha256_file
from evidence_agent.discovery.register import list_requests
from evidence_agent.discovery.escalation import build_escalation_queue
from evidence_agent.governance.custody import record_custody_event, verify_integrity
from evidence_agent.governance.manifest import export_manifest, duplicate_report
from evidence_agent.schema import init_all

# NOTE: the reasoning engine is intentionally NOT wired to this CLI — it requires
# an injected LLM analyst and is library-only (out of stdlib scope).


DEFAULT_EXCLUDE_DIRS = {
    ".git",
    ".venv",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    ".idea",
    ".vscode",
    "dist",
    "build",
}


def _to_utc_iso(epoch_seconds: float) -> str:
    return (
        datetime.fromtimestamp(epoch_seconds, tz=timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


def _iter_files(
    root: Path, include_hidden: bool, skip_file: Path | None = None
) -> Iterable[Path]:
    for current_root, dirs, files in os.walk(root):
        current_path = Path(current_root)
        rel_root = current_path.relative_to(root)
        if not include_hidden:
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            files = [f for f in files if not f.startswith(".")]
        dirs[:] = [d for d in dirs if d not in DEFAULT_EXCLUDE_DIRS]

        for name in sorted(files):
            candidate = current_path / name
            if skip_file is not None and candidate.resolve() == skip_file.resolve():
                continue
            if candidate.is_file():
                yield rel_root / name if rel_root != Path(".") else Path(name)


def compile_manifest(source_dir: Path, output_file: Path, include_hidden: bool) -> dict:
    source_dir = source_dir.resolve()
    output_file = output_file.resolve()

    if not source_dir.exists() or not source_dir.is_dir():
        raise FileNotFoundError(f"Source directory does not exist: {source_dir}")

    entries: list[dict] = []
    for rel_path in _iter_files(source_dir, include_hidden, skip_file=output_file):
        absolute = source_dir / rel_path
        stat = absolute.stat()
        entries.append(
            {
                "path": rel_path.as_posix(),
                "bytes": stat.st_size,
                "modified_utc": _to_utc_iso(stat.st_mtime),
                "sha256": sha256_file(absolute),
            }
        )

    manifest = {
        "compiled_at_utc": _to_utc_iso(datetime.now(tz=timezone.utc).timestamp()),
        "source_directory": source_dir.as_posix(),
        "file_count": len(entries),
        "files": entries,
    }

    output_file.parent.mkdir(parents=True, exist_ok=True)
    with output_file.open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")

    return manifest


def ingest_directory(
    conn,
    matter_id: str,
    source_dir: Path,
    *,
    source_label: str | None = None,
    include_hidden: bool = False,
    actor: str = "evidence-agent",
    skip_file: Path | None = None,
) -> dict:
    """Register every file under `source_dir` as an Original artefact.

    Idempotent: a file whose absolute path and sha256 already exist for the
    matter is skipped, so re-running after adding files only registers the
    new ones. Each registration appends an "ingested" custody event.
    """
    source_dir = source_dir.resolve()
    if not source_dir.exists() or not source_dir.is_dir():
        raise FileNotFoundError(f"Source directory does not exist: {source_dir}")

    label = source_label or source_dir.name
    ingested: list[dict] = []
    skipped = 0
    for rel_path in _iter_files(source_dir, include_hidden, skip_file=skip_file):
        absolute = (source_dir / rel_path).resolve()
        digest = sha256_file(absolute)
        existing = conn.execute(
            "SELECT id FROM artefacts WHERE matter_id = ? AND path = ? AND sha256 = ?",
            (matter_id, absolute.as_posix(), digest),
        ).fetchone()
        if existing is not None:
            skipped += 1
            continue
        artefact = add_artefact(
            conn,
            matter_id,
            ArtefactClass.ORIGINAL,
            label,
            absolute.as_posix(),
            metadata={
                "relative_path": rel_path.as_posix(),
                "bytes": absolute.stat().st_size,
            },
        )
        record_custody_event(
            conn,
            artefact.id,
            "ingested",
            actor,
            _to_utc_iso(datetime.now(tz=timezone.utc).timestamp()),
            note=f"Ingested from {source_dir.as_posix()}",
        )
        ingested.append({"artefact_id": artefact.id, "path": rel_path.as_posix()})

    return {
        "matter_id": matter_id,
        "source_directory": source_dir.as_posix(),
        "source_label": label,
        "ingested": ingested,
        "skipped": skipped,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="evidence-agent",
        description="Compile an evidence folder into a hash-indexed manifest.",
    )
    # Default action is compile for ergonomic CLI use; these top-level defaults
    # make `run([])` (no subcommand) compile with the same defaults as `compile`.
    parser.set_defaults(
        source=".", output="build/evidence_bundle.json", include_hidden=False
    )
    subparsers = parser.add_subparsers(dest="command")

    compile_parser = subparsers.add_parser(
        "compile",
        help="Compile source evidence files into a JSON manifest.",
    )
    compile_parser.add_argument(
        "--source",
        default=".",
        help="Directory to compile (default: current directory).",
    )
    compile_parser.add_argument(
        "--output",
        default="build/evidence_bundle.json",
        help="Manifest output path (default: build/evidence_bundle.json).",
    )
    compile_parser.add_argument(
        "--include-hidden",
        action="store_true",
        help="Include hidden files and directories in the manifest.",
    )

    init_parser = subparsers.add_parser(
        "init",
        help="Initialise a matter database (all subsystem tables).",
    )
    init_parser.add_argument("--db", required=True, help="Path to the matter DB.")

    ingest_parser = subparsers.add_parser(
        "ingest",
        help="Register every file in a directory as an Original artefact.",
    )
    ingest_parser.add_argument("--db", required=True, help="Path to the matter DB.")
    ingest_parser.add_argument("--matter", required=True, help="Matter id.")
    ingest_parser.add_argument(
        "--source",
        default=".",
        help="Directory to ingest (default: current directory).",
    )
    ingest_parser.add_argument(
        "--source-label",
        default=None,
        help="Provenance label recorded on each artefact "
        "(default: the source directory name).",
    )
    ingest_parser.add_argument(
        "--actor",
        default="evidence-agent",
        help="Actor recorded on each custody event (default: evidence-agent).",
    )
    ingest_parser.add_argument(
        "--include-hidden",
        action="store_true",
        help="Include hidden files and directories.",
    )

    manifest_parser = subparsers.add_parser(
        "manifest",
        help="Print the artefact manifest and duplicate report as JSON.",
    )
    manifest_parser.add_argument("--db", required=True, help="Path to the matter DB.")
    manifest_parser.add_argument("--matter", required=True, help="Matter id.")

    verify_parser = subparsers.add_parser(
        "verify",
        help="Verify integrity of every Original artefact for a matter.",
    )
    verify_parser.add_argument("--db", required=True, help="Path to the matter DB.")
    verify_parser.add_argument("--matter", required=True, help="Matter id.")

    discovery_parser = subparsers.add_parser(
        "discovery",
        help="Print the discovery register and escalation queue as JSON.",
    )
    discovery_parser.add_argument("--db", required=True, help="Path to the matter DB.")
    discovery_parser.add_argument("--matter", required=True, help="Matter id.")
    discovery_parser.add_argument(
        "--as-of", required=True, help="Escalation reference date (YYYY-MM-DD)."
    )

    return parser


def _cmd_compile(args: argparse.Namespace) -> int:
    source = Path(args.source)
    output = Path(args.output)
    manifest = compile_manifest(source, output, args.include_hidden)
    print(
        f"Compiled {manifest['file_count']} files from "
        f"{Path(args.source).resolve()} -> {output.resolve()}"
    )
    return 0


def _cmd_init(args: argparse.Namespace) -> int:
    conn = db.connect(args.db)
    init_all(conn)
    print(f"Initialised matter DB at {args.db}")
    return 0


def _cmd_ingest(args: argparse.Namespace) -> int:
    conn = db.connect(args.db)
    init_all(conn)  # idempotent; lets ingest run against a brand-new DB path
    result = ingest_directory(
        conn,
        args.matter,
        Path(args.source),
        source_label=args.source_label,
        include_hidden=args.include_hidden,
        actor=args.actor,
        skip_file=Path(args.db),
    )
    for entry in result["ingested"]:
        print(f"{entry['artefact_id']} {entry['path']}")
    print(
        f"Ingested {len(result['ingested'])} files "
        f"({result['skipped']} already registered) from "
        f"{result['source_directory']} into matter {result['matter_id']}"
    )
    return 0


def _cmd_manifest(args: argparse.Namespace) -> int:
    conn = db.connect(args.db)
    print(
        json.dumps(
            {
                "manifest": export_manifest(conn, args.matter),
                "duplicates": duplicate_report(conn, args.matter),
            },
            indent=2,
        )
    )
    return 0


def _cmd_verify(args: argparse.Namespace) -> int:
    conn = db.connect(args.db)
    all_ok = True
    for art in list_artefacts(conn, args.matter, ArtefactClass.ORIGINAL):
        ok = verify_integrity(conn, art.id)
        all_ok = all_ok and ok
        print(f"{art.id} {'OK' if ok else 'FAIL'}")
    return 0 if all_ok else 1


def _jsonable(obj):
    """json.dumps default: unwrap dataclasses to dicts and enums to their values."""
    if is_dataclass(obj):
        return asdict(obj)
    if isinstance(obj, Enum):
        return obj.value
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def _cmd_discovery(args: argparse.Namespace) -> int:
    conn = db.connect(args.db)
    print(
        json.dumps(
            {
                "register": list_requests(conn, args.matter),
                "escalation": build_escalation_queue(conn, args.matter, args.as_of),
            },
            indent=2,
            default=_jsonable,
        )
    )
    return 0


def run(argv: list[str]) -> int:
    """Build the parser, dispatch on the subcommand, and return an exit code."""
    parser = build_parser()
    args = parser.parse_args(argv)

    command = args.command or "compile"
    if command == "compile":
        return _cmd_compile(args)
    if command == "init":
        return _cmd_init(args)
    if command == "ingest":
        return _cmd_ingest(args)
    if command == "manifest":
        return _cmd_manifest(args)
    if command == "verify":
        return _cmd_verify(args)
    if command == "discovery":
        return _cmd_discovery(args)

    parser.print_help()
    return 2


def main() -> None:
    raise SystemExit(run(sys.argv[1:]))


if __name__ == "__main__":
    main()

