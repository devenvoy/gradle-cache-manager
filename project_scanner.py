"""
project_scanner.py — Cross-Project Gradle & Version Catalog Scanner

Discovers local Gradle projects, parses version catalogs (libs.versions.toml),
Gradle wrapper properties, and gradle.properties. Detects version drift across
projects and calculates a unified Machine Golden Baseline.

Features:
  - Discovers projects under ~/Developer (or custom paths)
  - Parses [versions], [libraries], [plugins] from libs.versions.toml
  - Reads gradle/wrapper/gradle-wrapper.properties
  - Reads gradle.properties
  - Detects version drift and computes unified recommendations
  - Safely modifies project files with automated .bak backups
  - Manages ~/.gradle/gcm-baseline.json
"""

import os
import re
import json
import shutil
from pathlib import Path
from datetime import datetime

BASELINE_FILE = Path.home() / ".gradle" / "gcm-baseline.json"
PROJECTS_REGISTRY_FILE = Path.home() / ".gradle" / "gcm-projects.json"

# Key frameworks to track and align across projects
KEY_DEPENDENCY_KEYS = [
    "kotlin", "agp", "compose", "composeMultiplatform", "compose-multiplatform",
    "ktor", "koin", "coroutines", "kotlinxCoroutines", "serialization",
    "kotlinxSerializationJson", "ksp", "room", "coil", "coilCompose",
    "androidx-lifecycle", "androidx-core", "androidx-appcompat",
    "firebase-bom", "firebaseBom", "navigationCompose", "sqlite"
]

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

def get_registered_project_paths() -> list[str]:
    """Load persistent list of registered project paths from ~/.gradle/gcm-projects.json."""
    if not PROJECTS_REGISTRY_FILE.exists():
        return []
    try:
        data = json.loads(PROJECTS_REGISTRY_FILE.read_text())
        if isinstance(data, list):
            return [str(p) for p in data if Path(p).is_dir()]
    except Exception:
        pass
    return []

def save_registered_project_paths(paths: list[str]):
    """Save persistent list of registered project paths to ~/.gradle/gcm-projects.json."""
    unique = sorted(list(set(str(Path(p).resolve()) for p in paths if Path(p).is_dir())))
    PROJECTS_REGISTRY_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROJECTS_REGISTRY_FILE.write_text(json.dumps(unique, indent=2))

def register_project(path_str: str, name: str = None) -> dict | None:
    """Register a new project path dynamically (e.g. from Android Studio plugin or user UI)."""
    p = Path(path_str).resolve()
    if not p.is_dir():
        return None
    proj_data = inspect_project(p)
    if proj_data:
        current_paths = get_registered_project_paths()
        p_str = str(p)
        if p_str not in current_paths:
            current_paths.append(p_str)
            save_registered_project_paths(current_paths)
    return proj_data

def unregister_project(path_str: str) -> bool:
    """Unregister a project path from ~/.gradle/gcm-projects.json."""
    current_paths = get_registered_project_paths()
    target = str(Path(path_str).resolve())
    if target in current_paths:
        current_paths.remove(target)
        save_registered_project_paths(current_paths)
        return True
    return False

def discover_projects(search_dir: Path = None) -> list[dict]:
    """
    Find all Gradle projects dynamically.
    Combines:
      1. Registered projects from ~/.gradle/gcm-projects.json (reported by plugin or manually added)
      2. Auto-discovery under ~/Developer (and any sub-directories or search dirs)
    """
    discovered_paths = set(get_registered_project_paths())

    if search_dir is None:
        search_dir = Path.home() / "Developer"

    if search_dir.exists():
        for child in sorted(search_dir.iterdir()):
            if not child.is_dir() or child.name.startswith("."):
                continue
            has_gradle = (child / "gradle").is_dir() or (child / "gradlew").is_file() or (child / "build.gradle.kts").is_file() or (child / "build.gradle").is_file()
            if has_gradle:
                discovered_paths.add(str(child.resolve()))

    projects = []
    valid_paths = []
    for path_str in sorted(discovered_paths):
        p_path = Path(path_str)
        if not p_path.is_dir():
            continue
        proj_data = inspect_project(p_path)
        if proj_data:
            projects.append(proj_data)
            valid_paths.append(str(p_path.resolve()))

    save_registered_project_paths(valid_paths)
    return projects

def inspect_project(proj_dir: Path) -> dict:
    """Inspect a single project and extract its versions, wrapper, and properties."""
    toml_path = proj_dir / "gradle" / "libs.versions.toml"
    wrapper_path = proj_dir / "gradle" / "wrapper" / "gradle-wrapper.properties"
    props_path = proj_dir / "gradle.properties"

    versions = {}
    if toml_path.exists():
        try:
            versions = parse_toml_versions(toml_path.read_text(errors="ignore"))
        except Exception:
            pass

    wrapper = parse_wrapper_props(wrapper_path) if wrapper_path.exists() else {}
    props = parse_gradle_properties(props_path) if props_path.exists() else {}

    return {
        "name": proj_dir.name,
        "path": str(proj_dir),
        "has_toml": toml_path.exists(),
        "toml_path": str(toml_path),
        "versions": versions,
        "wrapper": wrapper,
        "properties": props,
    }

def parse_toml_versions(text: str) -> dict[str, str]:
    """Extract [versions] key-value pairs from libs.versions.toml."""
    versions = {}
    in_versions = False
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("[versions]"):
            in_versions = True
            continue
        elif line.startswith("["):
            in_versions = False
            continue

        if in_versions and "=" in line and not line.startswith("#"):
            parts = line.split("=", 1)
            k = parts[0].strip()
            v = parts[1].strip().strip("\"'")
            if k and v:
                versions[k] = v
    return versions

def parse_wrapper_props(path: Path) -> dict:
    """Extract distribution version and url from gradle-wrapper.properties."""
    data = {"url": "", "version": "", "type": "bin"}
    if not path.exists():
        return data
    try:
        text = path.read_text(errors="ignore")
        for line in text.splitlines():
            line = line.strip()
            if line.startswith("distributionUrl"):
                url = line.split("=", 1)[1].strip().replace("\\:", ":")
                data["url"] = url
                # Extract version e.g. gradle-8.14-bin.zip -> 8.14
                m = re.search(r"gradle-([0-9.]+)-([a-z]+)\.zip", url)
                if m:
                    data["version"] = m.group(1)
                    data["type"] = m.group(2)
    except Exception:
        pass
    return data

def parse_gradle_properties(path: Path) -> dict[str, str]:
    """Extract properties from gradle.properties."""
    props = {}
    if not path.exists():
        return props
    try:
        for line in path.read_text(errors="ignore").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                props[k.strip()] = v.strip()
    except Exception:
        pass
    return props

def compute_drift_matrix(projects: list[dict]) -> dict:
    """
    Compare versions across all projects and compute:
      - All tracked keys
      - Per-library drift details (projects using each version)
      - Recommended baseline versions (highest stable version found)
      - Wrapper status
    """
    # Collect all version keys
    key_usage: dict[str, dict[str, list[str]]] = {}
    all_projects = [p["name"] for p in projects]

    for p in projects:
        p_name = p["name"]
        for k, v in p["versions"].items():
            if k not in key_usage:
                key_usage[k] = {}
            if v not in key_usage[k]:
                key_usage[k][v] = []
            key_usage[k][v].append(p_name)

    # Calculate drift and recommended baseline
    matrix = []
    recommended_baseline = {}

    for k, versions_map in sorted(key_usage.items()):
        versions_list = list(versions_map.keys())
        has_drift = len(versions_list) > 1

        # Pick highest version as recommended
        try:
            sorted_v = sorted(versions_list, key=parse_semver_key)
            recommended_v = sorted_v[-1]
        except Exception:
            recommended_v = versions_list[0]

        recommended_baseline[k] = recommended_v

        matrix.append({
            "key": k,
            "has_drift": has_drift,
            "version_count": len(versions_list),
            "versions": versions_map,  # { "2.4.0": ["NutriTrack"], "2.4.10": ["Zevva"] }
            "recommended": recommended_v,
            "is_priority": k.lower() in [x.lower() for x in KEY_DEPENDENCY_KEYS]
        })

    # Wrapper drift
    wrapper_usage = {}
    for p in projects:
        w_v = p["wrapper"].get("version") or "unknown"
        if w_v not in wrapper_usage:
            wrapper_usage[w_v] = []
        wrapper_usage[w_v].append(p["name"])

    wrapper_versions = [v for v in wrapper_usage.keys() if v != "unknown"]
    try:
        recommended_wrapper = sorted(wrapper_versions, key=parse_semver_key)[-1] if wrapper_versions else "8.14"
    except Exception:
        recommended_wrapper = "8.14"

    return {
        "projects": all_projects,
        "matrix": matrix,
        "recommended_baseline": recommended_baseline,
        "wrapper_drift": {
            "has_drift": len(wrapper_usage) > 1,
            "versions": wrapper_usage,
            "recommended": recommended_wrapper,
        },
        "total_drifts": sum(1 for m in matrix if m["has_drift"]),
    }

# =========================================================================
# BASELINE STORAGE & PERSISTENCE
# =========================================================================

def load_stored_baseline() -> dict:
    """Load ~/.gradle/gcm-baseline.json or return defaults."""
    if BASELINE_FILE.exists():
        try:
            return json.loads(BASELINE_FILE.read_text())
        except Exception:
            pass
    return {}

def save_stored_baseline(baseline: dict) -> None:
    """Save machine golden baseline to ~/.gradle/gcm-baseline.json."""
    BASELINE_FILE.parent.mkdir(parents=True, exist_ok=True)
    BASELINE_FILE.write_text(json.dumps(baseline, indent=2))

def get_or_create_baseline(projects: list[dict] = None) -> dict:
    """Get stored baseline or compute from current projects."""
    stored = load_stored_baseline()
    if stored and stored.get("versions"):
        return stored

    if projects is None:
        projects = discover_projects()

    analysis = compute_drift_matrix(projects)
    baseline = {
        "updated_at": datetime.now().isoformat(),
        "versions": analysis["recommended_baseline"],
        "wrapper": {
            "version": analysis["wrapper_drift"]["recommended"],
            "type": "bin",
            "url": f"https://services.gradle.org/distributions/gradle-{analysis['wrapper_drift']['recommended']}-bin.zip"
        },
        "properties": {
            "org.gradle.caching": "true",
            "org.gradle.parallel": "true",
            "org.gradle.daemon": "true",
            "org.gradle.jvmargs": "-Xmx4g -XX:+UseParallelGC -XX:MaxMetaspaceSize=512m",
            "org.gradle.vfs.watch": "true",
            "kotlin.daemon.jvmargs": "-Xmx2g",
            "android.nonTransitiveRClass": "true",
            "android.useAndroidX": "true"
        }
    }
    save_stored_baseline(baseline)
    return baseline

# =========================================================================
# PROJECT ALIGNMENT (FILE MODIFICATION WITH BACKUPS)
# =========================================================================

def apply_alignment_to_project(project_path: str, target_versions: dict[str, str],
                               align_wrapper: bool = True, target_wrapper: str = None,
                               align_properties: bool = True) -> dict:
    """
    Safely update a project's libs.versions.toml, gradle-wrapper.properties, and gradle.properties.
    Creates .bak backup files before making any modifications.
    """
    proj = Path(project_path)
    if not proj.exists():
        return {"success": False, "error": f"Project not found: {project_path}"}

    toml_path = proj / "gradle" / "libs.versions.toml"
    wrapper_path = proj / "gradle" / "wrapper" / "gradle-wrapper.properties"
    props_path = proj / "gradle.properties"

    changes = []
    backups = []

    # 1. Update libs.versions.toml
    if toml_path.exists() and target_versions:
        bak_path = toml_path.with_suffix(f".toml.bak.{int(datetime.now().timestamp())}")
        shutil.copy2(toml_path, bak_path)
        backups.append(str(bak_path))

        lines = toml_path.read_text(errors="ignore").splitlines()
        new_lines = []
        in_versions = False

        for line in lines:
            stripped = line.strip()
            if stripped.startswith("[versions]"):
                in_versions = True
                new_lines.append(line)
                continue
            elif stripped.startswith("["):
                in_versions = False

            if in_versions and "=" in stripped and not stripped.startswith("#"):
                parts = stripped.split("=", 1)
                k = parts[0].strip()
                old_v = parts[1].strip().strip("\"'")
                if k in target_versions and target_versions[k] != old_v:
                    new_v = target_versions[k]
                    # Preserve indentation and quote style
                    quote = "\"" if "\"" in line else "'"
                    new_lines.append(f"{k} = {quote}{new_v}{quote}")
                    changes.append(f"libs.versions.toml: {k} = {old_v} -> {new_v}")
                else:
                    new_lines.append(line)
            else:
                new_lines.append(line)

        toml_path.write_text("\n".join(new_lines) + "\n")

    # 2. Update gradle-wrapper.properties
    if align_wrapper and wrapper_path.exists() and target_wrapper:
        bak_path = wrapper_path.with_suffix(f".properties.bak.{int(datetime.now().timestamp())}")
        shutil.copy2(wrapper_path, bak_path)
        backups.append(str(bak_path))

        lines = wrapper_path.read_text(errors="ignore").splitlines()
        new_lines = []
        target_url = f"https\\://services.gradle.org/distributions/gradle-{target_wrapper}-bin.zip"
        for line in lines:
            if line.strip().startswith("distributionUrl"):
                new_lines.append(f"distributionUrl={target_url}")
                changes.append(f"gradle-wrapper.properties: updated to {target_wrapper}")
            else:
                new_lines.append(line)
        wrapper_path.write_text("\n".join(new_lines) + "\n")

    # 3. Update gradle.properties (Ensure performance & shared cache flags)
    if align_properties and props_path.exists():
        bak_path = props_path.with_suffix(f".properties.bak.{int(datetime.now().timestamp())}")
        shutil.copy2(props_path, bak_path)
        backups.append(str(bak_path))

        lines = props_path.read_text(errors="ignore").splitlines()
        existing_keys = set()
        for line in lines:
            if "=" in line and not line.strip().startswith("#"):
                existing_keys.add(line.split("=", 1)[0].strip())

        recommended = {
            "org.gradle.caching": "true",
            "org.gradle.parallel": "true",
        }
        added = []
        for k, v in recommended.items():
            if k not in existing_keys:
                added.append(f"{k}={v}")
                changes.append(f"gradle.properties: added {k}={v}")

        if added:
            new_content = "\n".join(lines) + "\n\n# Shared Optimization Flags\n" + "\n".join(added) + "\n"
            props_path.write_text(new_content)

    return {
        "success": True,
        "project": proj.name,
        "changes": changes,
        "backups": backups,
    }
