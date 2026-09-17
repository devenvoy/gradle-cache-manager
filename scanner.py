"""
Filesystem scanner for Gradle and Kotlin/Native caches.

Provides functions to scan, measure, and report on:
  - Gradle wrapper distributions
  - Cached dependency libraries
  - Build and transform caches
  - Daemon logs and data
  - Kotlin/Native (.konan) compiler artifacts

All scan functions return plain dicts/lists ready for JSON serialization.
"""

import os
from pathlib import Path
from datetime import datetime

GRADLE_HOME = Path.home() / ".gradle"
KONAN_HOME = Path.home() / ".konan"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def format_size(size_bytes: int) -> str:
    """Format bytes into a human-readable string (e.g. '1.4 GB')."""
    if size_bytes == 0:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    idx = 0
    size = float(size_bytes)
    while size >= 1024 and idx < len(units) - 1:
        size /= 1024
        idx += 1
    return f"{size:.1f} {units[idx]}"


def get_dir_size(path: Path) -> int:
    """Recursively compute the total size of *path* in bytes."""
    total = 0
    try:
        for dirpath, _, filenames in os.walk(path):
            for fname in filenames:
                try:
                    total += os.path.getsize(os.path.join(dirpath, fname))
                except (OSError, FileNotFoundError):
                    pass
    except (OSError, PermissionError):
        pass
    return total


def get_mod_time(path: Path) -> str:
    """Return the last-modified timestamp as a readable string."""
    try:
        ts = os.path.getmtime(path)
        return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M")
    except (OSError, FileNotFoundError):
        return "Unknown"


def _dir_entry(path: Path) -> dict:
    """Build a standard entry dict for a single directory."""
    size = get_dir_size(path)
    return {
        "name": path.name,
        "path": str(path),
        "size": size,
        "size_fmt": format_size(size),
        "modified": get_mod_time(path),
    }


# ---------------------------------------------------------------------------
# Scanners
# ---------------------------------------------------------------------------

def scan_distributions() -> list[dict]:
    """Return a list of Gradle wrapper distributions."""
    dists_dir = GRADLE_HOME / "wrapper" / "dists"
    if not dists_dir.exists():
        return []
    return [_dir_entry(d) for d in sorted(dists_dir.iterdir()) if d.is_dir()]


def scan_libraries() -> dict:
    """
    Return cached dependency libraries grouped by Maven group ID.

    Structure:
        { "com.google.code.gson": {
              "artifacts": [ { "name": "gson", "versions": [...], ... } ],
              "total_size": 123456,
              "total_size_fmt": "120.5 KB",
              "path": "/Users/.../.gradle/caches/modules-2/files-2.1/com.google.code.gson"
          }, ... }
    """
    modules_dir = GRADLE_HOME / "caches" / "modules-2" / "files-2.1"
    if not modules_dir.exists():
        return {}

    libraries: dict = {}
    for group_dir in sorted(modules_dir.iterdir()):
        if not group_dir.is_dir():
            continue
        artifacts = []
        group_size = 0
        for artifact_dir in sorted(group_dir.iterdir()):
            if not artifact_dir.is_dir():
                continue
            versions = []
            for version_dir in sorted(artifact_dir.iterdir()):
                if not version_dir.is_dir():
                    continue
                vsize = get_dir_size(version_dir)
                group_size += vsize
                versions.append({
                    "version": version_dir.name,
                    "size": vsize,
                    "size_fmt": format_size(vsize),
                    "path": str(version_dir),
                })
            if versions:
                artifacts.append({
                    "name": artifact_dir.name,
                    "versions": versions,
                    "version_count": len(versions),
                })
        if artifacts:
            libraries[group_dir.name] = {
                "artifacts": artifacts,
                "total_size": group_size,
                "total_size_fmt": format_size(group_size),
                "path": str(group_dir),
            }
    return libraries


def scan_caches() -> list[dict]:
    """Return top-level cache subdirectories inside ~/.gradle/caches/."""
    caches_dir = GRADLE_HOME / "caches"
    if not caches_dir.exists():
        return []
    return [_dir_entry(d) for d in sorted(caches_dir.iterdir()) if d.is_dir()]


def scan_daemons() -> list[dict]:
    """Return Gradle daemon data directories."""
    daemon_dir = GRADLE_HOME / "daemon"
    if not daemon_dir.exists():
        return []
    return [_dir_entry(d) for d in sorted(daemon_dir.iterdir()) if d.is_dir()]


def scan_konan() -> list[dict]:
    """Return Kotlin/Native cache directories."""
    if not KONAN_HOME.exists():
        return []
    return [_dir_entry(d) for d in sorted(KONAN_HOME.iterdir()) if d.is_dir()]


def get_overview() -> dict:
    """
    Return an overview dict mapping human-readable labels to size info
    for each major cache section.
    """
    sections = {
        "Gradle Home": GRADLE_HOME,
        "Distributions": GRADLE_HOME / "wrapper" / "dists",
        "Dependencies": GRADLE_HOME / "caches",
        "Build Cache": GRADLE_HOME / "caches" / "build-cache-1",
        "Daemons": GRADLE_HOME / "daemon",
        "Kotlin/Native": KONAN_HOME,
    }
    result = {}
    for label, path in sections.items():
        if path.exists():
            size = get_dir_size(path)
            result[label] = {"path": str(path), "size": size, "size_fmt": format_size(size)}
        else:
            result[label] = {"path": str(path), "size": 0, "size_fmt": "—"}
    return result


def scan_all() -> dict:
    """Run every scanner and return the combined payload."""
    return {
        "overview": get_overview(),
        "distributions": scan_distributions(),
        "libraries": scan_libraries(),
        "caches": scan_caches(),
        "daemons": scan_daemons(),
        "konan": scan_konan(),
    }
