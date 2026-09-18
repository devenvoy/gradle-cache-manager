# Gradle Cache Manager & Version Guard

A modern, high-performance workspace tool to inspect, align, and optimize your local Gradle environment. Designed specifically for Android and Kotlin Multiplatform (KMP) developers to **enforce identical library versions across all projects**, eliminate duplicate cache downloads, and reclaim gigabytes of disk storage on your main drive.

---

## Key Pillars

### 1. 🔄 Cross-Project Version Alignment Hub
- **Multi-Project Scanner**: Automatically discovers all Gradle projects in `~/Developer` (e.g. `Linkora`, `My-Ration`, `Zevva`, `finkeep`, `NutriTrack`).
- **Drift Matrix**: Parses `gradle/libs.versions.toml` across projects to detect mismatches in Kotlin, AGP, Compose Multiplatform, Ktor, Koin, Coroutines, etc.
- **1-Click Machine Alignment**: Syncs all your projects to a unified, recommended baseline with automatic `.bak` safety backups.
- **Global `init.d` Enforcer**: Optional machine-wide script (`~/.gradle/init.d/align-cache-versions.gradle.kts`) that forces Gradle builds anywhere on your computer to resolve dependencies using the machine baseline, preventing background re-downloads.

### 2. 🛡️ Android Studio Plugin ("Gradle Version Guard")
Located in `plugins/android-studio-plugin/`:
- **Pre-Sync Interception**: Hooks into Android Studio when a project opens or before Gradle Sync begins.
- **Pre-Sync Alignment Dialog**: Compares project versions against your machine baseline (`~/.gradle/gcm-baseline.json` or local daemon):
  - Lists all mismatched library versions (e.g. Kotlin `2.4.0` vs Machine `2.4.10`).
  - Recommends the matching Gradle Wrapper distribution.
  - Suggests missing performance & caching flags in `gradle.properties`.
- **1-Click "Align & Sync"**: Safely updates `libs.versions.toml`, `gradle-wrapper.properties`, and `gradle.properties` before syncing so Gradle reuses existing cached jars!

### 3. 🧹 Clean Libraries Hub & 1-Click Deduplication
- **Direct vs Transitive Filtering**:
  - **Direct / Frameworks (Default)**: Shows high-level libraries you actually declare in your projects (`AndroidX`, `Kotlin`, `Compose Multiplatform`, `Ktor`, `Koin`, `Room`, `Firebase`).
  - **Tucks Away Transitive Noise**: Low-level runtime jars (`bouncycastle`, `asm`, `guava`) and parent POMs (`error_prone_parent`, `project`) are hidden from clutter.
- **Project Presence Badges**: Every cached artifact displays which of your local projects (`NutriTrack`, `Zevva`, etc.) currently use it.
- **1-Click "Clean Old Versions (Keep Latest)"**: Automatically deletes older duplicate version directories while keeping the latest version of each artifact intact, instantly reclaiming hundreds of megabytes.

### 4. 📦 Gradle Wrapper Distribution Manager
- View all downloaded Gradle wrapper versions in `~/.gradle/wrapper/dists/`.
- 1-Click "Use" generator to copy ready-to-paste `gradle-wrapper.properties` configuration.
- Safely delete unused legacy wrapper versions.

### 5. ⚙️ Interactive `gradle.properties` Builder
- 50+ curated flags covering Gradle Core, JVM, Android (AGP), Kotlin, Compose Multiplatform, KSP, Room, and CI.
- Type-aware inputs, search, category chips, and live preview.
- 1-Click "Select Recommended", copy to clipboard, or download `gradle.properties`.
- Dynamic sync/import from remote documentation URLs or JSON.

---

## Quick Start

### Running the Web Dashboard

```bash
# View all commands
make help

# Run in foreground and open browser (http://localhost:8484)
make run

# Start as background daemon
make start

# Check status
make status

# 1-Click align all local projects from terminal
make align-projects

# 1-Click prune older duplicate library versions from cache
make prune-cache
```

### Installing the Android Studio Plugin

```bash
# Build the plugin distribution zip
make build-plugin
```

Then in **Android Studio / IntelliJ IDEA**:
1. Open **Settings / Preferences** (`Cmd + ,`).
2. Go to **Plugins** -> click the ⚙️ gear icon -> **Install Plugin from Disk...**.
3. Select `plugins/android-studio-plugin/build/distributions/gradle-version-guard-1.0.0.zip`.
4. Restart Android Studio.
5. Next time you open any project, **Gradle Version Guard** will automatically check for version drift and offer 1-click alignment!

---

## Architecture & Project Layout

```
gradle-cache-manager/
├── Makefile                       # Control commands (run, start, align, prune, build-plugin)
├── README.md                      # Project documentation
├── DOCUMENTATION.md               # Technical specifications & API reference
├── gradle_cache_manager.py        # Python server & REST API router
├── project_scanner.py             # Multi-project scanner, drift matrix & baseline engine
├── init_enforcer.py               # Global ~/.gradle/init.d enforcer generator
├── scanner.py                     # Cache inspection with ecosystem & SemVer analysis
├── deleter.py                     # Safety-guarded deletion and library deduplication
├── flags_registry.py              # 50+ flags catalog & dynamic sync/import logic
├── templates/
│   └── index.html                 # Semantic HTML shell with tab navigation
├── static/
│   ├── style.css                  # GitHub Dark theme with drift matrix & badge styling
│   ├── icons.js                   # SVG stroke icons (Lucide-style)
│   ├── components.js              # Pure render functions (Alignment, Libraries, Properties)
│   └── app.js                     # State management, API calls, and event handlers
└── plugins/
    └── android-studio-plugin/     # Android Studio / IntelliJ Plugin
        ├── build.gradle.kts       # IntelliJ Platform plugin build
        └── src/main/kotlin/       # PreSyncDialog, ProjectVersionChecker, VersionAligner
```

---

## Safety Guarantees

- **Guarded Path Deletion**: The backend verifies all deletion paths against `_ALLOWED_ROOTS` (`~/.gradle` and `~/.konan`), strictly rejecting any outside paths.
- **Automated Backup Copies**: Modifying `libs.versions.toml`, `gradle-wrapper.properties`, or `gradle.properties` always generates a timestamped `.bak` file alongside the original.
- **Zero Heavy Dependencies**: The core dashboard runs on Python 3 standard libraries with no node_modules or pip requirements.
