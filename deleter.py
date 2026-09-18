"""
Safe deletion operations for Gradle and Kotlin/Native caches.

All delete operations are safety-guarded to only remove paths
that reside under ~/.gradle or ~/.konan.
"""

import shutil
import subprocess
from pathlib import Path

from scanner import GRADLE_HOME, KONAN_HOME, format_size, get_dir_size

# Roots that we are allowed to delete inside of.
_ALLOWED_ROOTS = (str(GRADLE_HOME), str(KONAN_HOME))


class DeleteError(Exception):
    """Raised when a deletion is refused or fails."""


def _assert_safe(path: Path) -> None:
    """Raise if *path* is outside the allowed roots."""
    resolved = str(path.resolve())
    if not any(resolved.startswith(root) for root in _ALLOWED_ROOTS):
        raise DeleteError(
            f"Refusing to delete path outside Gradle/Konan home: {path}"
        )


def delete_paths(paths: list[str]) -> dict:
    """
    Delete every path in *paths*.

    Returns ``{"success": True, "deleted": N, "freed": bytes, "freed_fmt": "..."}``.
    Raises ``DeleteError`` on safety violations.
    """
    deleted = 0
    freed = 0

    for p in paths:
        target = Path(p)
        _assert_safe(target)

        if not target.exists():
            continue

        size = get_dir_size(target) if target.is_dir() else target.stat().st_size
        freed += size

        if target.is_dir():
            shutil.rmtree(target, ignore_errors=True)
        else:
            target.unlink(missing_ok=True)
        deleted += 1

    return {
        "success": True,
        "deleted": deleted,
        "freed": freed,
        "freed_fmt": format_size(freed),
    }


def stop_daemons() -> str:
    """Attempt to stop all running Gradle daemons."""
    for cmd in (["gradle", "--stop"], [str(GRADLE_HOME / "wrapper" / "gradle"), "--stop"]):
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=30,
            )
            msg = result.stdout.strip() or result.stderr.strip()
            if msg:
                return msg
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue

    return "No running Gradle daemons found, or the gradle binary is not on PATH."


def deduplicate_libraries(scope: str = None) -> dict:
    """
    Find all stale / older versions across cached libraries and delete them,
    keeping only the latest version of each artifact intact.
    If scope is provided (e.g. 'org.jetbrains.kotlin'), only deduplicates within that group.
    """
    from scanner import scan_libraries
    libs = scan_libraries()
    stale_paths = []

    for group_name, group_info in libs.items():
        if scope and group_name != scope:
            continue
        for artifact in group_info["artifacts"]:
            for v in artifact["versions"]:
                if v.get("is_stale"):
                    stale_paths.append(v["path"])

    if not stale_paths:
        return {"success": True, "deleted": 0, "freed": 0, "freed_fmt": "0 B", "message": "No duplicate stale versions found."}

    return delete_paths(stale_paths)

