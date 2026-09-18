"""
Filesystem scanner for Gradle and Kotlin/Native caches.

Provides functions to scan, measure, and report on:
  - Gradle wrapper distributions
  - Cached dependency libraries (with Ecosystem classification, SemVer analysis,
    stale version detection, and project cross-referencing)
  - Build and transform caches
  - Daemon logs and data
  - Kotlin/Native (.konan) compiler artifacts

All scan functions return plain dicts/lists ready for JSON serialization.
"""

import os
import re
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


def parse_semver_key(v_str: str) -> list:
    """Parse version string into comparable tuple."""
    tokens = re.findall(r"\d+|[a-zA-Z]+", v_str)
    parts = []
    for t in tokens:
        if t.isdigit():
            parts.append((0, int(t)))
        else:
            tag = t.lower()
            weight = {"alpha": -4, "beta": -3, "rc": -2, "m": -5, "preview": -4, "snapshot": -6}.get(tag, -1)
            parts.append((1, weight, tag))
    return parts


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


def classify_library(group: str, artifact: str) -> tuple[str, str]:
    """
    Classify a library into (ecosystem, kind).
    Kinds: 'direct' (frameworks), 'plugin' (tooling), 'parent_pom', 'transitive' (internals).
    """
    g = group.lower()
    a = artifact.lower()

    # 1. Parent POM check
    if a.endswith("-parent") or a.endswith("_parent") or a == "project" or g.endswith("-parent"):
        return ("Transitive & Internals", "parent_pom")

    # 2. Build Tools & Plugins
    if "com.android.tools.build" in g or "gradle" in g or "com.google.devtools.ksp" in g or "compiler-embeddable" in a:
        return ("Build Tools & Plugins", "plugin")

    # 3. Compose Multiplatform
    if "org.jetbrains.compose" in g or "org.jetbrains.skiko" in g:
        return ("Compose Multiplatform", "direct")

    # 4. Kotlin Ecosystem
    if "org.jetbrains.kotlin" in g or "kotlinx" in g:
        return ("Kotlin Ecosystem", "direct")

    # 5. AndroidX & Jetpack
    if g.startswith("androidx."):
        return ("AndroidX & Jetpack", "direct")

    # 6. Networking & Web
    if "io.ktor" in g or "okhttp" in g or "retrofit" in g or "com.squareup.okhttp3" in g:
        return ("Networking & Web", "direct")

    # 7. Architecture, DI & Storage
    if "insert-koin" in g or "room" in a or "datastore" in a or "sqldelight" in g or "sqliter" in g or "dagger" in g or "hilt" in g:
        return ("Architecture & Storage", "direct")

    # 8. Image & Media
    if "coil" in g or "coil" in a or "media3" in g or "media3" in a:
        return ("Image & Media", "direct")

    # 9. Firebase & Google Cloud
    if "com.google.firebase" in g or "com.google.android.gms" in g or "play-services" in a:
        return ("Firebase & Google", "direct")

    # 10. Common Transitive / Low-Level Internals
    transitive_indicators = [
        "bouncycastle", "asm", "guava", "errorprone", "error_prone",
        "protobuf", "bytebuddy", "checkerframework", "jcip", "jsr305",
        "intellij.deps", "org.apache", "net.bytebuddy"
    ]
    if any(ti in g or ti in a for ti in transitive_indicators):
        return ("Transitive & Internals", "transitive")

    # Default to direct third-party
    return ("Third-Party Libraries", "direct")


# ---------------------------------------------------------------------------
# Scanners
# ---------------------------------------------------------------------------

def scan_distributions() -> list[dict]:
    """Return a list of Gradle wrapper distributions."""
    dists_dir = GRADLE_HOME / "wrapper" / "dists"
    if not dists_dir.exists():
        return []
    return [_dir_entry(d) for d in sorted(dists_dir.iterdir()) if d.is_dir()]


def scan_libraries(project_usage_map: dict = None) -> dict:
    """
    Return cached dependency libraries grouped by Maven group ID.
    Enriched with:
      - Ecosystem & Kind classification
      - SemVer chronological ordering
      - Stale version tagging and reclaimable size calculation
      - Project usage cross-referencing
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
        group_stale_size = 0
        group_ecosystems = set()
        group_kinds = set()

        for artifact_dir in sorted(group_dir.iterdir()):
            if not artifact_dir.is_dir():
                continue

            ecosystem, kind = classify_library(group_dir.name, artifact_dir.name)
            group_ecosystems.add(ecosystem)
            group_kinds.add(kind)

            raw_versions = []
            for version_dir in sorted(artifact_dir.iterdir()):
                if not version_dir.is_dir():
                    continue
                vsize = get_dir_size(version_dir)
                raw_versions.append({
                    "version": version_dir.name,
                    "size": vsize,
                    "size_fmt": format_size(vsize),
                    "path": str(version_dir),
                })

            if not raw_versions:
                continue

            # Sort versions chronologically via SemVer
            try:
                sorted_versions = sorted(raw_versions, key=lambda v: parse_semver_key(v["version"]))
            except Exception:
                sorted_versions = raw_versions

            # Tag latest vs stale
            art_stale_size = 0
            for i, v in enumerate(sorted_versions):
                is_latest = (i == len(sorted_versions) - 1)
                v["is_latest"] = is_latest
                v["is_stale"] = not is_latest and len(sorted_versions) > 1
                if v["is_stale"]:
                    art_stale_size += v["size"]

            group_stale_size += art_stale_size
            art_total_size = sum(v["size"] for v in sorted_versions)
            group_size += art_total_size

            # Check project usage
            coord = f"{group_dir.name}:{artifact_dir.name}"
            used_by = project_usage_map.get(coord, []) if project_usage_map else []

            artifacts.append({
                "name": artifact_dir.name,
                "ecosystem": ecosystem,
                "kind": kind,
                "versions": sorted_versions,
                "version_count": len(sorted_versions),
                "has_drift": len(sorted_versions) > 1,
                "total_size": art_total_size,
                "total_size_fmt": format_size(art_total_size),
                "stale_size": art_stale_size,
                "stale_size_fmt": format_size(art_stale_size),
                "latest_version": sorted_versions[-1]["version"] if sorted_versions else "",
                "used_in_projects": used_by,
            })

        if artifacts:
            primary_ecosystem = next(iter(group_ecosystems)) if len(group_ecosystems) == 1 else "Various"
            primary_kind = "direct" if "direct" in group_kinds else (next(iter(group_kinds)) if group_kinds else "transitive")

            libraries[group_dir.name] = {
                "ecosystem": primary_ecosystem,
                "kind": primary_kind,
                "artifacts": artifacts,
                "total_size": group_size,
                "total_size_fmt": format_size(group_size),
                "stale_size": group_stale_size,
                "stale_size_fmt": format_size(group_stale_size),
                "has_sprawl": group_stale_size > 0,
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


def generate_suite_toml(suite_id: str, version: str) -> str:
    """Generate production-ready libs.versions.toml block for a framework suite."""
    if suite_id == "kotlin":
        return f"""[versions]
kotlin = "{version}"

[libraries]
kotlin-stdlib = {{ module = "org.jetbrains.kotlin:kotlin-stdlib", version.ref = "kotlin" }}
kotlin-reflect = {{ module = "org.jetbrains.kotlin:kotlin-reflect", version.ref = "kotlin" }}

[plugins]
kotlin-multiplatform = {{ id = "org.jetbrains.kotlin.multiplatform", version.ref = "kotlin" }}
kotlin-android = {{ id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }}
kotlin-serialization = {{ id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }}"""

    elif suite_id == "compose_multiplatform":
        return f"""[versions]
compose-multiplatform = "{version}"

[libraries]
compose-runtime = {{ module = "org.jetbrains.compose.runtime:runtime", version.ref = "compose-multiplatform" }}
compose-foundation = {{ module = "org.jetbrains.compose.foundation:foundation", version.ref = "compose-multiplatform" }}
compose-material3 = {{ module = "org.jetbrains.compose.material3:material3", version.ref = "compose-multiplatform" }}
compose-ui = {{ module = "org.jetbrains.compose.ui:ui", version.ref = "compose-multiplatform" }}

[plugins]
compose-compiler = {{ id = "org.jetbrains.compose", version.ref = "compose-multiplatform" }}"""

    elif suite_id == "ktor":
        return f"""[versions]
ktor = "{version}"

[libraries]
ktor-client-core = {{ module = "io.ktor:ktor-client-core", version.ref = "ktor" }}
ktor-client-cio = {{ module = "io.ktor:ktor-client-cio", version.ref = "ktor" }}
ktor-client-content-negotiation = {{ module = "io.ktor:ktor-client-content-negotiation", version.ref = "ktor" }}
ktor-serialization-kotlinx-json = {{ module = "io.ktor:ktor-serialization-kotlinx-json", version.ref = "ktor" }}"""

    elif suite_id == "koin":
        return f"""[versions]
koin = "{version}"

[libraries]
koin-core = {{ module = "io.insert-koin:koin-core", version.ref = "koin" }}
koin-compose = {{ module = "io.insert-koin:koin-compose", version.ref = "koin" }}
koin-android = {{ module = "io.insert-koin:koin-android", version.ref = "koin" }}"""

    elif suite_id == "coil":
        return f"""[versions]
coil = "{version}"

[libraries]
coil = {{ module = "io.coil-kt.coil3:coil", version.ref = "coil" }}
coil-compose = {{ module = "io.coil-kt.coil3:coil-compose", version.ref = "coil" }}
coil-network-ktor = {{ module = "io.coil-kt.coil3:coil-network-ktor3", version.ref = "coil" }}"""

    elif suite_id == "agp":
        return f"""[versions]
agp = "{version}"

[plugins]
android-application = {{ id = "com.android.application", version.ref = "agp" }}
android-library = {{ id = "com.android.library", version.ref = "agp" }}"""

    elif suite_id == "androidx_compose":
        return f"""[versions]
compose = "{version}"

[libraries]
androidx-compose-ui = {{ module = "androidx.compose.ui:ui", version.ref = "compose" }}
androidx-compose-material3 = {{ module = "androidx.compose.material3:material3", version.ref = "compose" }}
androidx-compose-foundation = {{ module = "androidx.compose.foundation:foundation", version.ref = "compose" }}"""

    return f"""[versions]
library-version = "{version}"
"""


def scan_suites(libraries: dict, projects: list = None) -> list[dict]:
    """
    Aggregate raw Maven libraries into high-level developer framework suites.
    Developers think in terms of Kotlin, Compose, Ktor, Koin, AGP suites — not 43 separate internal compiler jars.
    """
    suite_defs = [
        {
            "id": "kotlin",
            "name": "Kotlin Ecosystem",
            "icon": "🔷",
            "description": "Kotlin compiler, standard libraries, reflect, and multiplatform Gradle plugins",
            "project_keys": ["kotlin", "kotlinStdlib", "kotlinVersion"],
            "matcher": lambda g, a: "org.jetbrains.kotlin" in g,
        },
        {
            "id": "compose_multiplatform",
            "name": "Compose Multiplatform",
            "icon": "🟣",
            "description": "JetBrains Compose Multiplatform UI framework, Skiko rendering, and desktop/iOS runtimes",
            "project_keys": ["compose-multiplatform", "composeMultiplatform", "composeVersion"],
            "matcher": lambda g, a: "org.jetbrains.compose" in g or "skiko" in g,
        },
        {
            "id": "androidx_compose",
            "name": "Jetpack Compose (Android)",
            "icon": "🎨",
            "description": "Android Compose UI toolkit, Material3, Foundation, and animations",
            "project_keys": ["compose", "androidx-compose-material3", "composeBom"],
            "matcher": lambda g, a: g.startswith("androidx.compose."),
        },
        {
            "id": "androidx_core",
            "name": "AndroidX Core & Architecture",
            "icon": "🟢",
            "description": "Lifecycle, Activity, AppCompat, Navigation, Room, and DataStore",
            "project_keys": ["androidx-core", "androidx-lifecycle", "room"],
            "matcher": lambda g, a: g.startswith("androidx.") and not g.startswith("androidx.compose."),
        },
        {
            "id": "agp",
            "name": "Android Gradle Plugin (AGP)",
            "icon": "⚙️",
            "description": "Android build tools, R8 shrinker, manifest merger, and AGP plugins",
            "project_keys": ["agp", "androidGradlePlugin"],
            "matcher": lambda g, a: "com.android.tools" in g,
        },
        {
            "id": "ktor",
            "name": "Ktor HTTP Client",
            "icon": "🌐",
            "description": "Asynchronous multiplatform HTTP client, CIO engine, and content negotiation",
            "project_keys": ["ktor", "ktorVersion"],
            "matcher": lambda g, a: "io.ktor" in g,
        },
        {
            "id": "koin",
            "name": "Koin Dependency Injection",
            "icon": "💉",
            "description": "Lightweight pure Kotlin dependency injection for KMP and Compose",
            "project_keys": ["koin", "koin-compose", "koinVersion"],
            "matcher": lambda g, a: "insert-koin" in g,
        },
        {
            "id": "coil",
            "name": "Coil Image Loading",
            "icon": "🖼️",
            "description": "Asynchronous image loading and caching for Compose Multiplatform",
            "project_keys": ["coil", "coilCompose"],
            "matcher": lambda g, a: "coil" in g,
        },
        {
            "id": "firebase",
            "name": "Firebase & Google Services",
            "icon": "🔥",
            "description": "Google Play services, Firebase Analytics, Auth, and Messaging",
            "project_keys": ["firebase-bom", "firebaseBom"],
            "matcher": lambda g, a: "com.google.firebase" in g or "com.google.android.gms" in g,
        },
        {
            "id": "square",
            "name": "Square Libraries",
            "icon": "⬛",
            "description": "OkHttp HTTP client and Retrofit REST library",
            "project_keys": ["okhttp", "retrofit"],
            "matcher": lambda g, a: "com.squareup" in g,
        },
    ]

    suites = []
    matched_groups = set()

    for s_def in suite_defs:
        s_id = s_def["id"]
        s_name = s_def["name"]
        matcher = s_def["matcher"]

        total_size = 0
        art_count = 0
        version_data = {}  # ver -> { size, paths: [], art_count }

        for g_name, g_info in libraries.items():
            for art in g_info["artifacts"]:
                if matcher(g_name, art["name"]):
                    matched_groups.add(g_name)
                    art_count += 1
                    total_size += art["total_size"]
                    for v in art["versions"]:
                        v_str = v["version"]
                        if v_str not in version_data:
                            version_data[v_str] = {"size": 0, "paths": [], "artifacts": set()}
                        version_data[v_str]["size"] += v["size"]
                        version_data[v_str]["paths"].append(v["path"])
                        version_data[v_str]["artifacts"].add(art["name"])

        if art_count == 0:
            continue

        # Sort versions chronologically
        try:
            sorted_v_strings = sorted(version_data.keys(), key=parse_semver_key)
        except Exception:
            sorted_v_strings = sorted(version_data.keys())

        latest_version = sorted_v_strings[-1] if sorted_v_strings else ""
        stale_size = 0

        versions_list = []
        for i, v_str in enumerate(sorted_v_strings):
            v_info = version_data[v_str]
            is_latest = (i == len(sorted_v_strings) - 1)

            # Check if this version is used by any project
            used_by = []
            if projects:
                for proj in projects:
                    proj_vers = proj.get("versions", {})
                    for k in s_def.get("project_keys", []):
                        if proj_vers.get(k) == v_str:
                            used_by.append(proj.get("name"))
                            break

            in_use = len(used_by) > 0
            is_stale = (not is_latest and not in_use and len(sorted_v_strings) > 1)
            if is_stale:
                stale_size += v_info["size"]

            versions_list.append({
                "version": v_str,
                "size": v_info["size"],
                "size_fmt": format_size(v_info["size"]),
                "is_latest": is_latest,
                "in_use": in_use,
                "used_by_projects": used_by,
                "is_stale": is_stale,
                "artifact_count": len(v_info["artifacts"]),
                "paths": v_info["paths"],
                "toml_snippet": generate_suite_toml(s_id, v_str),
            })

        suites.append({
            "id": s_id,
            "name": s_name,
            "icon": s_def["icon"],
            "description": s_def["description"],
            "total_size": total_size,
            "total_size_fmt": format_size(total_size),
            "stale_size": stale_size,
            "stale_size_fmt": format_size(stale_size),
            "has_sprawl": stale_size > 0,
            "artifact_count": art_count,
            "latest_version": latest_version,
            "versions": versions_list,
        })

    return suites


def scan_all(project_usage: dict = None) -> dict:
    """Run every scanner and return the combined payload."""
    projects = []
    try:
        from project_scanner import discover_projects
        projects = discover_projects()
    except Exception:
        pass

    libs = scan_libraries(project_usage)
    return {
        "overview": get_overview(),
        "distributions": scan_distributions(),
        "suites": scan_suites(libs, projects),
        "libraries": libs,
        "caches": scan_caches(),
        "daemons": scan_daemons(),
        "konan": scan_konan(),
    }
