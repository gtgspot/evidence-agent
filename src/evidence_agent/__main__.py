#!/usr/bin/env python3
"""Compile evidence directories into a deterministic manifest."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from evidence_agent.core.hashing import sha256_file

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


def _iter_files(root: Path, output_file: Path, include_hidden: bool) -> Iterable[Path]:
    for current_root, dirs, files in os.walk(root):
        current_path = Path(current_root)
        rel_root = current_path.relative_to(root)
        if not include_hidden:
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            files = [f for f in files if not f.startswith(".")]
        dirs[:] = [d for d in dirs if d not in DEFAULT_EXCLUDE_DIRS]

        for name in sorted(files):
            candidate = current_path / name
            if candidate.resolve() == output_file.resolve():
                continue
            if candidate.is_file():
                yield rel_root / name if rel_root != Path(".") else Path(name)


def compile_manifest(source_dir: Path, output_file: Path, include_hidden: bool) -> dict:
    source_dir = source_dir.resolve()
    output_file = output_file.resolve()

    if not source_dir.exists() or not source_dir.is_dir():
        raise FileNotFoundError(f"Source directory does not exist: {source_dir}")

    entries: list[dict] = []
    for rel_path in _iter_files(source_dir, output_file, include_hidden):
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


def run(argv: list[str]) -> int:
    """Build the parser, dispatch on the subcommand, and return an exit code."""
    parser = build_parser()
    args = parser.parse_args(argv)

    command = args.command or "compile"
    if command == "compile":
        return _cmd_compile(args)

    parser.print_help()
    return 2


def main() -> None:
    raise SystemExit(run(sys.argv[1:]))


if __name__ == "__main__":
    main()

