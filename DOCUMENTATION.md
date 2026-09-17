# Gradle Cache Manager — Technical Architecture & API Documentation

This document describes the design philosophy, module boundaries, filesystem scanners, safety mechanisms, and REST API contracts for the **Gradle Cache Manager** application.

---

## 1. Architectural Principles

1. **Zero External Dependencies**: The backend runs entirely on Python 3 standard libraries (`http.server`, `urllib`, `pathlib`, `json`, `shutil`, `subprocess`). The frontend runs on vanilla ECMAScript (ES2020+) without node_modules, webpack, or external CDNs.
2. **Pure Functional UI Layer**: All user interface components in `static/components.js` are pure functions that transform data models into semantic HTML strings with zero side effects or DOM mutations.
3. **Unidirectional Data Flow**: State is centralized in `static/app.js` (`App` module). State changes trigger component rendering, and user interactions invoke API operations or update filtered views.
4. **Guarded Deletion Safety**: Destructive file operations are constrained to whitelisted directory roots (`~/.gradle` and `~/.konan`). Path traversal attempts are blocked by path resolution checks.

---

## 2. Backend Modules & Responsibilities

### `gradle_cache_manager.py` (Server & Router)
- **Role**: HTTP request dispatcher and process bootstrap.
- **Handlers**:
  - Serves static assets (`/static/*`) with appropriate MIME types.
  - Serves the HTML shell (`/`).
  - Routes REST API endpoints (`/api/*`) for scanning, deletion, daemon control, and flag management.
- **CLI Options**:
  - `--port <int>`: Configures listening port (default: 8484).
  - `--no-browser`: Disables auto-launching the system default browser.

### `scanner.py` (Filesystem Inspection)
- **Role**: Discovers and measures Gradle and Kotlin toolchain artifacts.
- **Key Functions**:
  - `scan_distributions()`: Scans `~/.gradle/wrapper/dists/` for wrapper distributions (`gradle-X.Y-bin`, `gradle-X.Y-all`).
  - `scan_libraries()`: Scans `~/.gradle/caches/modules-2/files-2.1/` to group cached artifacts by group ID, artifact name, and version, calculating sizes and file paths.
  - `scan_caches()`: Scans top-level cache stores inside `~/.gradle/caches/` (including `build-cache-1`, transforms, jars).
  - `scan_daemons()`: Inspects `~/.gradle/daemon/` directories for daemon logs and registry data.
  - `scan_konan()`: Inspects `~/.konan/` toolchains, dependencies, and Kotlin/Native sysroots.
  - `get_overview()`: Generates overall disk consumption metrics across all major cache subdirectories.

### `deleter.py` (Safe Deletion Operations)
- **Role**: Executes safe directory removal with path containment verification.
- **Safety Guarantee**:
  ```python
  def _assert_safe(path: Path) -> None:
      resolved = str(path.resolve())
      if not any(resolved.startswith(root) for root in _ALLOWED_ROOTS):
          raise DeleteError(f"Refusing to delete path outside Gradle/Konan: {path}")
  ```
- **Functions**:
  - `delete_paths(paths: list[str])`: Deletes targets, computing freed bytes and item counts.
  - `stop_daemons()`: Invokes `gradle --stop` using system or wrapper binaries to terminate background JVM daemons.

### `flags_registry.py` (Property Flags & Dynamic Updates)
- **Role**: Maintains catalog of 50+ flags across Gradle Core, JVM, Android (AGP), Kotlin, Compose Multiplatform, KSP, Room, and CI.
- **Storage**:
  - Built-in flags: Embedded in Python data structures.
  - Custom flags: Persisted locally at `~/.gradle/gcm-custom-flags.json`.
- **Functions**:
  - `get_all_flags()`: Returns merged list of built-in and user-defined flags.
  - `add_custom_flag(flag: dict)`: Inserts or updates a user flag.
  - `remove_custom_flag(key: str)`: Deletes a user flag by key.
  - `import_custom_flags(flags_list: list[dict])`: Bulk imports custom flags.
  - `fetch_and_import_remote_flags(url: str)`: Fetches flags from remote JSON URL.

---

## 3. Frontend Architecture

### `static/icons.js`
- Scalable Vector Graphics (SVG) icon library using clean 24x24 stroke icons (Lucide-inspired).
- Avoids emojis and heavy font icon packages. Uses `currentColor` for seamless theme integration.

### `static/style.css`
- Uses GitHub Dark neutral color tokens:
  - Canvas: `#0d1117`, Default Card: `#161b22`, Subtle: `#1c2128`, Border: `#30363d`
  - Accent: `#2f81f7`, Danger: `#f85149`, Success: `#3fb950`, Warning: `#d29922`
- Responsive split-grid layout for the Properties Builder (`1fr 380px` desktop, stacked on mobile).

### `static/components.js`
- Pure presentation templates for:
  - Metric summary cards (`overview()`).
  - Tables for distributions, caches, daemons, and Kotlin/Native items.
  - Nested, expandable library tree views with search filters (`libraries()`).
  - Code snippet modals for wrapper properties and multi-format dependency exports (`wrapperSnippetModal()`, `libSnippetModal()`).
  - Property flag cards with type-aware inputs and category chips (`propertiesBuilder()`).
  - Modals for adding custom flags and syncing remote definitions.

### `static/app.js`
- Central controller managing:
  - Tab routing: Distributions, Libraries, Caches, Daemons, Kotlin/Native, Properties.
  - Live preview generation with grouped category headers for `gradle.properties`.
  - Clipboard integration (async Clipboard API with fallback).
  - Toast notifications and modal overlays.

---

## 4. API Reference

### `GET /api/scan`
Returns complete filesystem analysis.
**Response**:
```json
{
  "overview": {
    "Gradle Home": { "path": "/Users/.../.gradle", "size": 123456, "size_fmt": "120.5 MB" },
    ...
  },
  "distributions": [
    { "name": "gradle-8.14-bin", "path": "...", "size": 150000000, "size_fmt": "143.0 MB", "modified": "2026-09-17 12:00" }
  ],
  "libraries": {
    "androidx.compose.ui": {
      "total_size": 25000000,
      "total_size_fmt": "23.8 MB",
      "path": "...",
      "artifacts": [
        {
          "name": "ui",
          "version_count": 2,
          "versions": [
            { "version": "1.7.0", "size": 12000000, "size_fmt": "11.4 MB", "path": "..." }
          ]
        }
      ]
    }
  },
  "caches": [...],
  "daemons": [...],
  "konan": [...]
}
```

### `GET /api/flags`
Returns all available flags and unique categories.
**Response**:
```json
{
  "flags": [
    {
      "key": "org.gradle.parallel",
      "default": "false",
      "type": "boolean",
      "category": "Gradle Core",
      "description": "Execute tasks from different projects in parallel.",
      "recommended": true,
      "link": "https://docs.gradle.org/...",
      "source": "builtin"
    }
  ],
  "categories": ["Android", "CI & Environment", "Compose Multiplatform", "Gradle Core", "Gradle JVM", "Jetpack Compose", "KSP", "Kotlin", "Room"]
}
```

### `POST /api/delete`
Deletes specified file or directory paths.
**Request**:
```json
{
  "paths": ["/Users/.../.gradle/wrapper/dists/gradle-7.5-bin"]
}
```
**Response**:
```json
{
  "success": true,
  "deleted": 1,
  "freed": 145000000,
  "freed_fmt": "138.3 MB"
}
```

### `POST /api/stop-daemons`
Terminates running Gradle daemons.
**Response**:
```json
{
  "message": "Stopping Daemon(s)"
}
```

### `POST /api/flags/add`
Registers or updates a custom flag.
**Request**:
```json
{
  "flag": {
    "key": "android.enableR8.fullMode",
    "category": "Android",
    "type": "boolean",
    "default": "true",
    "description": "Enable full mode optimizations in R8.",
    "recommended": true,
    "link": "https://developer.android.com/build/shrink-code"
  }
}
```
**Response**:
```json
{
  "success": true
}
```

### `POST /api/flags/remove`
Removes a custom flag by key.
**Request**:
```json
{
  "key": "android.enableR8.fullMode"
}
```
**Response**:
```json
{
  "success": true
}
```

### `POST /api/flags/import`
Bulk imports custom flags from a JSON list.
**Request**:
```json
{
  "flags": [
    { "key": "custom.flag", "category": "Custom", "description": "...", "default": "value" }
  ]
}
```
**Response**:
```json
{
  "success": true,
  "count": 1
}
```

### `POST /api/flags/sync-url`
Fetches and imports flags from a remote URL.
**Request**:
```json
{
  "url": "https://raw.githubusercontent.com/org/repo/main/flags.json"
}
```
**Response**:
```json
{
  "success": true,
  "count": 12
}
```
