# Gradle Cache Manager

A modern, lightweight, zero-dependency web dashboard to inspect, manage, and optimize your local Gradle environment. Designed specifically for Android, Kotlin Multiplatform (KMP), and Compose developers who need to keep their disk usage clean, manage shared distributions, and generate optimized build properties.

---

## Features

### 1. 📦 Gradle Wrapper Distribution Manager
- View all downloaded Gradle wrapper versions in `~/.gradle/wrapper/dists/`.
- Inspect disk usage and last-modified dates per version.
- **1-Click "Use" Generator**: Generates clean, ready-to-paste `gradle-wrapper.properties` configuration for any downloaded version so all your projects can share the same distribution.
- Safely delete legacy or unused wrapper versions to free gigabytes of disk space.

### 2. 📚 Cached Libraries & Dependency Inspector
- Browse every cached library artifact in `~/.gradle/caches/modules-2/files-2.1/` grouped by Maven group ID.
- Search dependencies in real-time across group, artifact, and version names.
- Expandable views showing every version, individual sizes, and size category badges.
- **1-Click "Use" Dependency Exporter**: Generates instant copyable code snippets for:
  - **Kotlin DSL** (`implementation("group:artifact:version")`)
  - **Groovy DSL** (`implementation 'group:artifact:version'`)
  - **Version Catalog TOML** (`libs.versions.toml` with `[versions]` + `[libraries]`)
  - **Maven XML** (`<dependency>` block)
- Bulk-select and delete obsolete library versions.

### 3. 💾 Build Cache, Daemon & Native Storage Control
- **Caches**: Monitor transform caches, build cache (`build-cache-1`), and metadata caches.
- **Daemons**: View daemon logs per Gradle version, with 1-click **Stop All Daemons** action.
- **Kotlin/Native**: Inspect and clean the `~/.konan` toolchain and compiler caches used by KMP targets.

### 4. ⚙️ Interactive `gradle.properties` Builder
- 50+ curated flags covering:
  - **Gradle Core & JVM**: parallel execution, build cache, configuration cache, daemon timeout, heap memory.
  - **Android (AGP)**: AndroidX, non-transitive R classes, Jetifier, build feature toggles, K2 UAST lint.
  - **Kotlin & KMP**: daemon memory, incremental compilation, multiplatform layouts, compiler caching.
  - **Compose Multiplatform**: UIKit (iOS), macOS, Web Canvas, Wasm, resource generator accessors.
  - **Jetpack Compose**: Android Compose build features.
  - **KSP & Room**: incremental processing, KSP2, Room schema location, Kotlin code generation.
  - **CI & Environment**: daemon performance monitoring, dependency verification.
- **Real-Time Search & Category Filters**: Search by flag key or description, filter with category chips.
- **Detailed Explanations & Official Documentation Links** on every flag card.
- **1-Click "Select Recommended"**: Automatically selects production-ready flags for peak performance.
- **Live Output Panel**: Formats flags into organized comment headers with 1-click **Copy to Clipboard** and **Download `gradle.properties`**.

### 5. 🔄 Dynamic Flag Updates & Custom Flags
- **Add Custom Flags**: Register any new or proprietary property key, category, description, and default value. Persisted to `~/.gradle/gcm-custom-flags.json`.
- **Sync via Remote URL**: Fetch and import latest flags dynamically from any raw JSON documentation URL.
- **Import JSON**: Paste custom flag JSON arrays to update or expand your team's flag database.

---

## Quick Start

### Requirements
- Python 3.9+ (No external pip dependencies required — uses pure Python standard library `http.server`, `urllib`, `pathlib`, `json`).
- macOS, Linux, or Windows (WSL).

### Running with Make

```bash
# View available commands
make help

# Run in foreground (opens browser to http://localhost:8484)
make run

# Run in background daemon mode
make start

# Check status
make status

# Stop background server
make stop

# Restart server
make restart

# Clean temp files and bytecode
make clean
```

### Running Directly with Python

```bash
# Start server (default port 8484)
python3 gradle_cache_manager.py

# Custom port
python3 gradle_cache_manager.py --port 9090

# Without auto-opening browser
python3 gradle_cache_manager.py --no-browser
```

Open **[http://localhost:8484](http://localhost:8484)** in your web browser.

---

## Project Structure

```
gradle-cache-manager/
├── Makefile                  # Build and lifecycle commands
├── README.md                 # Project overview and user guide
├── DOCUMENTATION.md          # Technical architecture & API reference
├── gradle_cache_manager.py   # HTTP server routing and daemon entrypoint
├── scanner.py                # Filesystem scanner for Gradle & Konan directories
├── deleter.py                # Guarded deletion operations with path safety assertions
├── flags_registry.py         # Curated flag catalog & dynamic sync/import logic
├── templates/
│   └── index.html            # Minimal semantic HTML shell
└── static/
    ├── style.css             # GitHub Dark theme tokens (no purple, professional styling)
    ├── icons.js              # SVG stroke icon library (Lucide-style, zero emojis)
    ├── components.js         # Pure HTML render functions (data -> HTML)
    └── app.js                # State management, API calls, event handlers, and modals
```

---

## Safety & Security

- **Strict Path Isolation**: All delete operations are validated in `deleter.py` through `_assert_safe()`. The application strictly refuses to delete any file or directory outside `~/.gradle` and `~/.konan`.
- **Zero Dependencies**: Built entirely with Python's built-in libraries and vanilla JavaScript, eliminating supply-chain vulnerabilities.
- **Confirmation Modals**: Every deletion requires explicit user confirmation via dialog modals before executing.

---

## License

MIT License. Free to use, modify, and distribute.
