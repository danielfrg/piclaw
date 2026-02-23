"""Scan a directory for markdown files and compute content hashes."""

import hashlib
import os
import uuid
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ScannedNote:
    """A markdown file discovered on disk with its metadata."""

    relative_path: str
    title: str
    content: str
    content_hash: str
    point_id: str  # deterministic UUID derived from relative_path


def _strip_frontmatter(text: str) -> str:
    """Remove YAML frontmatter delimited by --- markers."""
    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            return text[end + 3 :].strip()
    return text


def _path_to_uuid(relative_path: str) -> str:
    """Derive a deterministic UUID from a relative file path.

    Uses UUID v5 (SHA-1 based) with a fixed namespace so the same path
    always produces the same point ID across runs.
    """
    namespace = uuid.UUID("a3e6b8d0-1f2c-4a5e-9d7b-0c8f3e4a6b12")
    return str(uuid.uuid5(namespace, relative_path))


def _content_hash(raw: str) -> str:
    """SHA-256 hash of raw file content, truncated to 16 hex chars."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def scan_directory(directory: Path) -> list[ScannedNote]:
    """Recursively find all .md files and return their metadata.

    Hidden files and directories (starting with '.') are skipped.
    """
    directory = directory.resolve()
    if not directory.is_dir():
        raise FileNotFoundError(f"Directory does not exist: {directory}")

    notes: list[ScannedNote] = []

    for dirpath, dirnames, filenames in os.walk(directory):
        # Skip hidden directories
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]

        for fname in filenames:
            if fname.startswith("."):
                continue
            if not fname.endswith(".md"):
                continue

            filepath = Path(dirpath) / fname
            try:
                raw = filepath.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue

            relative = str(filepath.relative_to(directory))
            clean = _strip_frontmatter(raw)

            # Skip empty notes
            if not clean.strip():
                continue

            notes.append(
                ScannedNote(
                    relative_path=relative,
                    title=filepath.stem,
                    content=clean,
                    content_hash=_content_hash(raw),
                    point_id=_path_to_uuid(relative),
                )
            )

    notes.sort(key=lambda n: n.relative_path)
    return notes
