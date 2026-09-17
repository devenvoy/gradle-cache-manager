"""
flags_registry.py — Comprehensive Gradle / Android / Kotlin / Compose
property flag definitions with dynamic update support.

Each flag is a dict with:
    key         : str   – property key (e.g. "org.gradle.parallel")
    default     : str   – default value
    type        : str   – "boolean" | "string" | "number" | "select"
    options     : list  – choices for "select" type (optional)
    category    : str   – grouping label
    description : str   – human-readable explanation
    recommended : bool  – whether this flag is recommended for most projects
    since       : str   – version/context when introduced (optional)
    link        : str   – documentation URL (optional)
"""

import json
from pathlib import Path

_CUSTOM_FLAGS_PATH = Path.home() / ".gradle" / "gcm-custom-flags.json"

# =========================================================================
# BUILT-IN FLAG REGISTRY
# =========================================================================

BUILTIN_FLAGS: list[dict] = [
    # ─────────────────────────────────────────────────────────────────────
    # GRADLE CORE — Build Execution
    # ─────────────────────────────────────────────────────────────────────
    {
        "key": "org.gradle.parallel",
        "default": "false",
        "type": "boolean",
        "category": "Gradle Core",
        "description": "Execute tasks from different projects in parallel. Dramatically speeds up multi-module builds.",
        "recommended": True,
        "link": "https://docs.gradle.org/current/userguide/performance.html#parallel_execution",
    },
    {
        "key": "org.gradle.caching",
        "default": "false",
        "type": "boolean",
        "category": "Gradle Core",
        "description": "Enable the Gradle build cache. Reuses outputs from previous builds to avoid re-executing unchanged tasks.",
        "recommended": True,
        "link": "https://docs.gradle.org/current/userguide/build_cache.html",
    },
    {
        "key": "org.gradle.daemon",
        "default": "true",
        "type": "boolean",
        "category": "Gradle Core",
        "description": "Keep the Gradle daemon running in the background for faster subsequent builds. Disable on CI to save memory.",
        "recommended": True,
        "link": "https://docs.gradle.org/current/userguide/gradle_daemon.html",
    },
    {
        "key": "org.gradle.daemon.idletimeout",
        "default": "10800000",
        "type": "number",
        "category": "Gradle Core",
        "description": "Milliseconds the daemon stays idle before shutting down. Default is 3 hours (10800000). Lower to save memory (e.g. 7200000 = 2h).",
        "recommended": False,
        "link": "https://docs.gradle.org/current/userguide/gradle_daemon.html#sec:daemon_expiration",
    },
    {
        "key": "org.gradle.configureondemand",
        "default": "false",
        "type": "boolean",
        "category": "Gradle Core",
        "description": "Only configure projects that are relevant to the requested tasks, rather than configuring all projects. Can speed up large builds.",
        "recommended": False,
        "link": "https://docs.gradle.org/current/userguide/multi_project_configuration_and_execution.html#sec:configuration_on_demand",
    },
    {
        "key": "org.gradle.configuration-cache",
        "default": "false",
        "type": "boolean",
        "category": "Gradle Core",
        "description": "Cache the result of the configuration phase. Subsequent builds skip configuration entirely if nothing changed.",
        "recommended": False,
        "since": "Gradle 8.1+",
        "link": "https://docs.gradle.org/current/userguide/configuration_cache.html",
    },
    {
        "key": "org.gradle.configuration-cache.problems",
        "default": "fail",
        "type": "select",
        "options": ["fail", "warn"],
        "category": "Gradle Core",
        "description": "How to handle configuration cache compatibility problems. 'warn' allows builds to proceed despite issues.",
        "recommended": False,
        "link": "https://docs.gradle.org/current/userguide/configuration_cache.html#config_cache:usage:ignore_problems",
    },
    {
        "key": "org.gradle.unsafe.isolated-projects",
        "default": "false",
        "type": "boolean",
        "category": "Gradle Core",
        "description": "Enable project isolation (experimental). Prevents projects from directly accessing each other's models.",
        "recommended": False,
        "since": "Gradle 8.5+",
        "link": "https://docs.gradle.org/current/userguide/isolated_projects.html",
    },
    {
        "key": "org.gradle.vfs.watch",
        "default": "true",
        "type": "boolean",
        "category": "Gradle Core",
        "description": "Use file system watching to detect changes between builds. Speeds up incremental builds significantly.",
        "recommended": True,
        "link": "https://docs.gradle.org/current/userguide/file_system_watching.html",
    },
    {
        "key": "org.gradle.workers.max",
        "default": "",
        "type": "number",
        "category": "Gradle Core",
        "description": "Maximum number of concurrent workers Gradle can use. Defaults to number of CPU cores. Lower on memory-constrained machines.",
        "recommended": False,
        "link": "https://docs.gradle.org/current/userguide/performance.html#adjust_the_number_of_parallel_workers",
    },
    {
        "key": "org.gradle.warning.mode",
        "default": "default",
        "type": "select",
        "options": ["all", "fail", "summary", "none", "default"],
        "category": "Gradle Core",
        "description": "Control deprecation warning output. 'all' shows every warning, 'fail' treats warnings as errors, 'summary' shows a count.",
        "recommended": False,
        "link": "https://docs.gradle.org/current/userguide/command_line_interface.html#sec:command_line_warnings",
    },
    {
        "key": "org.gradle.logging.level",
        "default": "lifecycle",
        "type": "select",
        "options": ["quiet", "warn", "lifecycle", "info", "debug"],
        "category": "Gradle Core",
        "description": "Set the default log level. 'lifecycle' is standard, 'info' shows more, 'debug' shows everything.",
        "recommended": False,
    },
    {
        "key": "org.gradle.console",
        "default": "auto",
        "type": "select",
        "options": ["auto", "plain", "rich", "verbose"],
        "category": "Gradle Core",
        "description": "Console output type. 'rich' enables color and progress bar, 'plain' for CI, 'verbose' for max detail.",
        "recommended": False,
    },

    # ─────────────────────────────────────────────────────────────────────
    # GRADLE CORE — JVM Settings
    # ─────────────────────────────────────────────────────────────────────
    {
        "key": "org.gradle.jvmargs",
        "default": "-Xmx512m",
        "type": "string",
        "category": "Gradle JVM",
        "description": "JVM arguments for the Gradle daemon. Increase heap for large projects (e.g. -Xmx4g -XX:+UseParallelGC -XX:MaxMetaspaceSize=512m).",
        "recommended": True,
        "link": "https://docs.gradle.org/current/userguide/build_environment.html#sec:configuring_jvm_memory",
    },
    {
        "key": "org.gradle.java.home",
        "default": "",
        "type": "string",
        "category": "Gradle JVM",
        "description": "Path to the JDK installation to use for running Gradle. Overrides JAVA_HOME.",
        "recommended": False,
    },

    # ─────────────────────────────────────────────────────────────────────
    # ANDROID (AGP)
    # ─────────────────────────────────────────────────────────────────────
    {
        "key": "android.useAndroidX",
        "default": "false",
        "type": "boolean",
        "category": "Android",
        "description": "Use AndroidX libraries instead of legacy Support Library. Required for all modern Android projects.",
        "recommended": True,
        "link": "https://developer.android.com/jetpack/androidx/migrate",
    },
    {
        "key": "android.nonTransitiveRClass",
        "default": "true",
        "type": "boolean",
        "category": "Android",
        "description": "Use non-transitive R classes. Each module only sees its own resources, reducing APK size and build time.",
        "recommended": True,
        "since": "AGP 8.0+",
        "link": "https://developer.android.com/build/optimize-your-build#use-non-transitive-r-classes",
    },
    {
        "key": "android.enableJetifier",
        "default": "false",
        "type": "boolean",
        "category": "Android",
        "description": "Auto-convert old Support Library dependencies to AndroidX. Only needed if using very old libraries that haven't migrated.",
        "recommended": False,
        "link": "https://developer.android.com/jetpack/androidx/migrate#jetifier",
    },
    {
        "key": "android.defaults.buildfeatures.buildconfig",
        "default": "false",
        "type": "boolean",
        "category": "Android",
        "description": "Generate BuildConfig class by default. Set to false if not used — saves compilation time.",
        "recommended": False,
        "since": "AGP 8.0+",
        "link": "https://developer.android.com/reference/tools/gradle-api/com/android/build/api/dsl/BuildFeatures#buildConfig()",
    },
    {
        "key": "android.defaults.buildfeatures.aidl",
        "default": "false",
        "type": "boolean",
        "category": "Android",
        "description": "Enable AIDL support by default. Disable if not using Android IPC to reduce build overhead.",
        "recommended": False,
        "since": "AGP 8.0+",
    },
    {
        "key": "android.defaults.buildfeatures.renderscript",
        "default": "false",
        "type": "boolean",
        "category": "Android",
        "description": "Enable RenderScript by default. Deprecated — disable unless using legacy RenderScript code.",
        "recommended": False,
    },
    {
        "key": "android.defaults.buildfeatures.resvalues",
        "default": "true",
        "type": "boolean",
        "category": "Android",
        "description": "Enable generated resource values (resValue). Disable if not using resValue() in build scripts.",
        "recommended": False,
        "since": "AGP 8.0+",
    },
    {
        "key": "android.defaults.buildfeatures.shaders",
        "default": "false",
        "type": "boolean",
        "category": "Android",
        "description": "Enable shader compilation support by default. Disable if not using OpenGL shaders.",
        "recommended": False,
    },
    {
        "key": "android.suppressUnsupportedCompileSdk",
        "default": "",
        "type": "number",
        "category": "Android",
        "description": "Suppress compile SDK warnings for a given API level. Useful when using preview SDKs (e.g. 35).",
        "recommended": False,
    },
    {
        "key": "android.experimental.enableScreenshotTest",
        "default": "false",
        "type": "boolean",
        "category": "Android",
        "description": "Enable the experimental Compose screenshot testing framework in AGP.",
        "recommended": False,
        "since": "AGP 8.5+",
    },
    {
        "key": "android.lint.useK2Uast",
        "default": "false",
        "type": "boolean",
        "category": "Android",
        "description": "Use the K2 UAST (Kotlin compiler frontend) for Android Lint checks. Faster lint analysis with Kotlin 2.x.",
        "recommended": False,
        "since": "AGP 8.4+",
    },
    {
        "key": "android.experimental.testOptions.managedDevices.customDevice",
        "default": "false",
        "type": "boolean",
        "category": "Android",
        "description": "Enable custom managed device definitions for automated Gradle-managed device testing.",
        "recommended": False,
        "since": "AGP 8.2+",
    },
    {
        "key": "android.experimental.lint.reserved-resources-support",
        "default": "false",
        "type": "boolean",
        "category": "Android",
        "description": "Enable reserved resources support in Lint to prevent future resource name collisions.",
        "recommended": False,
    },

    # ─────────────────────────────────────────────────────────────────────
    # KOTLIN
    # ─────────────────────────────────────────────────────────────────────
    {
        "key": "kotlin.code.style",
        "default": "official",
        "type": "select",
        "options": ["official", "obsolete"],
        "category": "Kotlin",
        "description": "Kotlin code style for IDE integration. Always use 'official' for modern projects.",
        "recommended": True,
    },
    {
        "key": "kotlin.daemon.jvmargs",
        "default": "",
        "type": "string",
        "category": "Kotlin",
        "description": "JVM arguments for the Kotlin compiler daemon. Increase heap for large KMP projects (e.g. -Xmx2g).",
        "recommended": True,
        "link": "https://kotlinlang.org/docs/gradle-compilation-and-caches.html#the-kotlin-daemon-and-how-it-falls-back-to-the-in-process-compilation",
    },
    {
        "key": "kotlin.incremental",
        "default": "true",
        "type": "boolean",
        "category": "Kotlin",
        "description": "Enable incremental compilation for Kotlin. Only recompiles changed files and their dependents.",
        "recommended": True,
        "link": "https://kotlinlang.org/docs/gradle-compilation-and-caches.html#incremental-compilation",
    },
    {
        "key": "kotlin.incremental.multiplatform",
        "default": "true",
        "type": "boolean",
        "category": "Kotlin",
        "description": "Enable incremental compilation for Kotlin Multiplatform common source sets.",
        "recommended": True,
        "since": "Kotlin 1.9+",
    },
    {
        "key": "kotlin.mpp.stability.nowarn",
        "default": "false",
        "type": "boolean",
        "category": "Kotlin",
        "description": "Suppress the Kotlin Multiplatform stability warning at build time.",
        "recommended": False,
    },
    {
        "key": "kotlin.mpp.androidGradlePluginCompatibility.nowarn",
        "default": "false",
        "type": "boolean",
        "category": "Kotlin",
        "description": "Suppress warnings about Kotlin Multiplatform and AGP compatibility.",
        "recommended": False,
    },
    {
        "key": "kotlin.mpp.androidSourceSetLayoutVersion",
        "default": "2",
        "type": "select",
        "options": ["1", "2"],
        "category": "Kotlin",
        "description": "Android source set layout version for KMP. Version 2 uses the modern layout (recommended).",
        "recommended": True,
        "since": "Kotlin 1.9+",
    },
    {
        "key": "kotlin.native.cacheKind",
        "default": "static",
        "type": "select",
        "options": ["static", "dynamic", "none"],
        "category": "Kotlin",
        "description": "Kotlin/Native compilation cache strategy. 'static' is fastest for debug, 'none' disables caching.",
        "recommended": False,
        "link": "https://kotlinlang.org/docs/native-improving-compilation-time.html#gradle-configuration-options",
    },
    {
        "key": "kotlin.native.binary.memoryModel",
        "default": "experimental",
        "type": "select",
        "options": ["experimental", "strict"],
        "category": "Kotlin",
        "description": "Kotlin/Native memory model. 'experimental' is the new model with concurrent mutability (default since 1.7.20).",
        "recommended": False,
    },
    {
        "key": "kotlin.suppressGradlePluginWarnings",
        "default": "false",
        "type": "boolean",
        "category": "Kotlin",
        "description": "Suppress all Kotlin Gradle plugin compatibility warnings.",
        "recommended": False,
    },
    {
        "key": "kotlin.apple.xcodeCompatibility.nowarn",
        "default": "false",
        "type": "boolean",
        "category": "Kotlin",
        "description": "Suppress warnings about Xcode and Kotlin/Native version compatibility.",
        "recommended": False,
        "since": "Kotlin 1.9+",
    },
    {
        "key": "kotlin.daemon.useFallbackStrategy",
        "default": "true",
        "type": "boolean",
        "category": "Kotlin",
        "description": "Fall back to in-process compilation if the Kotlin daemon fails to start.",
        "recommended": False,
    },
    {
        "key": "kotlin.build.report.output",
        "default": "",
        "type": "select",
        "options": ["file", "build_scan", "http", "json"],
        "category": "Kotlin",
        "description": "Output format for Kotlin build reports. Useful for analyzing build performance.",
        "recommended": False,
        "since": "Kotlin 1.7+",
        "link": "https://kotlinlang.org/docs/gradle-compilation-and-caches.html#build-reports",
    },

    # ─────────────────────────────────────────────────────────────────────
    # COMPOSE MULTIPLATFORM
    # ─────────────────────────────────────────────────────────────────────
    {
        "key": "org.jetbrains.compose.experimental.uikit.enabled",
        "default": "false",
        "type": "boolean",
        "category": "Compose Multiplatform",
        "description": "Enable Compose Multiplatform for iOS (UIKit integration). Required for iOS targets in CMP projects.",
        "recommended": False,
        "link": "https://www.jetbrains.com/help/kotlin-multiplatform-dev/compose-multiplatform-getting-started.html",
    },
    {
        "key": "org.jetbrains.compose.experimental.macos.enabled",
        "default": "false",
        "type": "boolean",
        "category": "Compose Multiplatform",
        "description": "Enable Compose Multiplatform for macOS native desktop targets.",
        "recommended": False,
    },
    {
        "key": "org.jetbrains.compose.experimental.jscanvas.enabled",
        "default": "false",
        "type": "boolean",
        "category": "Compose Multiplatform",
        "description": "Enable Compose Multiplatform for Web (Canvas-based Kotlin/JS). For Compose rendering in the browser.",
        "recommended": False,
    },
    {
        "key": "org.jetbrains.compose.experimental.wasm.enabled",
        "default": "false",
        "type": "boolean",
        "category": "Compose Multiplatform",
        "description": "Enable Compose Multiplatform for WebAssembly (Kotlin/Wasm). Experimental browser target using WASM.",
        "recommended": False,
        "since": "CMP 1.5+",
    },
    {
        "key": "compose.resources.always.generate.accessors",
        "default": "false",
        "type": "boolean",
        "category": "Compose Multiplatform",
        "description": "Always regenerate Compose resource accessors even when resources haven't changed.",
        "recommended": False,
    },
    {
        "key": "compose.desktop.verbose",
        "default": "false",
        "type": "boolean",
        "category": "Compose Multiplatform",
        "description": "Enable verbose logging for Compose Desktop packaging and distribution tasks.",
        "recommended": False,
    },

    # ─────────────────────────────────────────────────────────────────────
    # JETPACK COMPOSE (Android)
    # ─────────────────────────────────────────────────────────────────────
    {
        "key": "android.defaults.buildfeatures.compose",
        "default": "false",
        "type": "boolean",
        "category": "Jetpack Compose",
        "description": "Enable Jetpack Compose by default in all Android modules. Adds the Compose compiler plugin automatically.",
        "recommended": False,
        "since": "AGP 8.0+",
    },

    # ─────────────────────────────────────────────────────────────────────
    # KSP (Kotlin Symbol Processing)
    # ─────────────────────────────────────────────────────────────────────
    {
        "key": "ksp.incremental",
        "default": "true",
        "type": "boolean",
        "category": "KSP",
        "description": "Enable incremental processing for KSP annotation processors (Room, Koin, etc.).",
        "recommended": True,
        "link": "https://kotlinlang.org/docs/ksp-incremental.html",
    },
    {
        "key": "ksp.incremental.log",
        "default": "false",
        "type": "boolean",
        "category": "KSP",
        "description": "Log incremental KSP processing decisions. Useful for debugging cache misses.",
        "recommended": False,
    },
    {
        "key": "ksp.useKSP2",
        "default": "false",
        "type": "boolean",
        "category": "KSP",
        "description": "Use KSP2 implementation (built on K2 compiler). Faster processing and better error messages.",
        "recommended": False,
        "since": "KSP 2.0+",
    },

    # ─────────────────────────────────────────────────────────────────────
    # ROOM
    # ─────────────────────────────────────────────────────────────────────
    {
        "key": "room.schemaLocation",
        "default": "",
        "type": "string",
        "category": "Room",
        "description": "Directory to export Room database schemas for migration testing. Usually set in KSP args, but can be global.",
        "recommended": False,
        "link": "https://developer.android.com/training/data-storage/room/migrating-db-versions",
    },
    {
        "key": "room.incremental",
        "default": "true",
        "type": "boolean",
        "category": "Room",
        "description": "Enable incremental annotation processing for Room. Reduces recompilation on DAO changes.",
        "recommended": True,
    },
    {
        "key": "room.generateKotlin",
        "default": "false",
        "type": "boolean",
        "category": "Room",
        "description": "Generate Kotlin source instead of Java for Room DAO implementations.",
        "recommended": True,
        "since": "Room 2.6+",
    },

    # ─────────────────────────────────────────────────────────────────────
    # CI / BUILD ENVIRONMENT
    # ─────────────────────────────────────────────────────────────────────
    {
        "key": "org.gradle.daemon.performance.enable-monitoring",
        "default": "true",
        "type": "boolean",
        "category": "CI & Environment",
        "description": "Enable Gradle daemon performance monitoring. Disable on CI to reduce overhead.",
        "recommended": False,
    },
    {
        "key": "org.gradle.dependency.verification",
        "default": "",
        "type": "select",
        "options": ["strict", "lenient", "off"],
        "category": "CI & Environment",
        "description": "Dependency verification mode. 'strict' fails on unverified deps, 'lenient' warns.",
        "recommended": False,
        "link": "https://docs.gradle.org/current/userguide/dependency_verification.html",
    },
]


# =========================================================================
# DYNAMIC UPDATE SUPPORT
# =========================================================================

def _load_custom_flags() -> list[dict]:
    """Load user-added flags from the persistent JSON file."""
    if not _CUSTOM_FLAGS_PATH.exists():
        return []
    try:
        return json.loads(_CUSTOM_FLAGS_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return []


def _save_custom_flags(flags: list[dict]) -> None:
    """Persist user-added flags to disk."""
    _CUSTOM_FLAGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CUSTOM_FLAGS_PATH.write_text(json.dumps(flags, indent=2))


def get_all_flags() -> list[dict]:
    """
    Return the merged registry: built-in flags + user custom flags.
    Custom flags override built-in ones if they share the same key.
    """
    by_key: dict[str, dict] = {}
    for f in BUILTIN_FLAGS:
        by_key[f["key"]] = {**f, "source": "builtin"}
    for f in _load_custom_flags():
        by_key[f["key"]] = {**f, "source": "custom"}
    return list(by_key.values())


def add_custom_flag(flag: dict) -> None:
    """Add or update a single custom flag."""
    custom = _load_custom_flags()
    # Replace if exists
    custom = [f for f in custom if f["key"] != flag["key"]]
    custom.append(flag)
    _save_custom_flags(custom)


def remove_custom_flag(key: str) -> None:
    """Remove a custom flag by key."""
    custom = [f for f in _load_custom_flags() if f["key"] != key]
    _save_custom_flags(custom)


def import_custom_flags(flags_list: list[dict]) -> int:
    """Import a list of flags, updating existing ones by key."""
    custom = _load_custom_flags()
    by_key = {f["key"]: f for f in custom}
    count = 0
    for f in flags_list:
        if isinstance(f, dict) and f.get("key"):
            by_key[f["key"]] = f
            count += 1
    _save_custom_flags(list(by_key.values()))
    return count


def fetch_and_import_remote_flags(url: str) -> int:
    """Fetch flags JSON from a remote URL and import them."""
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": "GradleCacheManager/1.0"})
    with urllib.request.urlopen(req, timeout=10) as response:
        content = json.loads(response.read().decode("utf-8"))
        if isinstance(content, dict) and "flags" in content:
            flags_list = content["flags"]
        elif isinstance(content, list):
            flags_list = content
        else:
            raise ValueError("Expected list or dict with 'flags' key")
        return import_custom_flags(flags_list)


def get_categories() -> list[str]:
    """Return sorted unique category names."""
    return sorted({f["category"] for f in get_all_flags()})

