/**
 * components.js — UI rendering functions.
 *
 * Each function receives data (plain objects from the API) and returns
 * an HTML string.  The functions are pure — no side effects, no DOM
 * mutations.  The caller (app.js) is responsible for injecting the HTML.
 */

const Components = (() => {

    // --- Helpers ----------------------------------------------------

    function sizeTag(bytes) {
        if (bytes > 500 * 1024 * 1024)
            return `<span class="size-tag size-tag--lg">Large</span>`;
        if (bytes > 50 * 1024 * 1024)
            return `<span class="size-tag size-tag--md">Medium</span>`;
        return `<span class="size-tag size-tag--sm">Small</span>`;
    }

    function formatSize(bytes) {
        if (bytes === 0) return "0 B";
        const units = ["B", "KB", "MB", "GB", "TB"];
        let i = 0, s = bytes;
        while (s >= 1024 && i < units.length - 1) { s /= 1024; i++; }
        return s.toFixed(1) + " " + units[i];
    }

    function escapeAttr(str) {
        if (str == null) return "";
        const s = (typeof str === "object" && str.name) ? str.name : String(str);
        return s.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    }

    function escapeHtml(str) {
        if (str == null) return "";
        const s = (typeof str === "object" && str.name) ? str.name : String(str);
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // --- Overview ---------------------------------------------------

    function overview(data) {
        const items = Object.entries(data || {});
        if (!items.length) return "";
        return items.map(([label, info]) => `
            <div class="stat-card">
                <span class="stat-value">${info.size_fmt}</span>
                <span class="stat-label">${label}</span>
            </div>
        `).join("");
    }

    // --- Distributions ----------------------------------------------

    function distributions(list) {
        if (!list || !list.length) {
            return emptyState("No Gradle distributions found", "Run a Gradle build to download one.");
        }
        const totalSize = list.reduce((s, d) => s + d.size, 0);
        return `
            <div class="section-header">
                <h2>Wrapper Distributions (${list.length}) &middot; ${formatSize(totalSize)}</h2>
                <button class="btn btn--danger btn--sm" onclick="App.deleteSelected('dist-cb')">
                    ${Icons.trash(14)} Delete Selected
                </button>
            </div>
            <table class="data-table">
                <thead><tr>
                    <th><input type="checkbox" onchange="App.toggleAll(this,'dist-cb')"></th>
                    <th>Distribution</th>
                    <th>Size</th>
                    <th>Category</th>
                    <th>Last Modified</th>
                    <th></th>
                </tr></thead>
                <tbody>${list.map(d => `
                    <tr>
                        <td><input type="checkbox" class="dist-cb" data-path="${escapeAttr(d.path)}"></td>
                        <td class="cell-name">${Icons.package(16)} ${d.name}</td>
                        <td class="cell-size">${d.size_fmt}</td>
                        <td>${sizeTag(d.size)}</td>
                        <td class="cell-mono">${d.modified}</td>
                        <td>
                            <div class="action-cell">
                                <button class="btn btn--use btn--sm" onclick="App.showWrapperSnippet('${escapeAttr(d.name)}')">
                                    ${Icons.code(14)} Use
                                </button>
                                <button class="btn btn--danger btn--sm" onclick="App.requestDelete('${escapeAttr(d.path)}','${escapeAttr(d.name)}')">
                                    ${Icons.trash(14)}
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join("")}</tbody>
            </table>`;
    }

    // --- Projects & Alignment Hub -----------------------------------

    function alignment(data) {
        if (!data || !data.projects || !data.projects.length) {
            return `
                <div class="section-header">
                    <h2>Cross-Project Version Alignment (0 Projects)</h2>
                </div>
                <div class="enforcer-card" style="background:var(--bg-default);margin-bottom:16px;">
                    <div style="display:flex;align-items:center;gap:10px;flex:1;">
                        <span style="color:var(--accent);display:flex;align-items:center;">${Icons.folder(18)}</span>
                        <input type="text" id="newProjectPathInput" placeholder="Add external project path (e.g. /Users/devanshpc/.../my-app)..." style="flex:1;background:var(--bg-canvas);border:1px solid var(--border-default);padding:8px 12px;border-radius:var(--radius-sm);color:var(--fg-default);font-size:13px;font-family:var(--font-mono);">
                    </div>
                    <button class="btn btn--primary btn--sm" onclick="App.addProjectPath()">
                        ${Icons.plus(14)} Add Project
                    </button>
                </div>
                ${emptyState("No Gradle projects registered", "Enter a project path above or open your projects in Android Studio with the Gradle Version Guard plugin installed.")}
            `;
        }

        const projectNames = data.project_names || (data.projects || []).map(p => typeof p === "string" ? p : p.name);
        const matrix = data.matrix || [];
        const drifts = matrix.filter(m => m.has_drift);
        const enforcerOn = !!data.enforcer_enabled;
        const totalDrifts = data.total_drifts || drifts.length;

        const projectMap = {};
        (data.projects || []).forEach(p => {
            if (typeof p === "object" && p.name) {
                projectMap[p.name] = p.path;
            }
        });

        return `
            <div class="section-header">
                <h2>Cross-Project Version Alignment (${projectNames.length} Projects)</h2>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn--primary btn--sm" onclick="App.alignAllProjects()">
                        ${Icons.checkCheck(14)} Align All Projects to Baseline
                    </button>
                    <button class="btn btn--ghost btn--sm" onclick="App.deduplicateAllLibs()">
                        ${Icons.trash(14)} Clean Stale Cache Versions
                    </button>
                </div>
            </div>

            <!-- Alignment Status Banner -->
            <div class="alignment-banner">
                <div class="alignment-banner-text">
                    <h3>${Icons.gitBranch(18)} ${totalDrifts > 0 ? `${totalDrifts} Version Mismatches Detected` : 'All Projects Are Aligned!'}</h3>
                    <p>
                        ${totalDrifts > 0
                            ? `Your projects use different versions of key libraries. Aligning them forces all projects to share the exact same cached jars on your main drive.`
                            : `All ${projectNames.length} projects share the same library versions and cached dependencies. Zero duplicate storage waste.`
                        }
                    </p>
                </div>
                <div class="alignment-banner-actions">
                    <button class="btn btn--primary" onclick="App.alignAllProjects()">
                        ${Icons.checkCheck(14)} Sync All to Baseline
                    </button>
                </div>
            </div>

            <!-- Add Project Bar -->
            <div class="enforcer-card" style="background:var(--bg-default);">
                <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:260px;">
                    <span style="color:var(--accent);display:flex;align-items:center;">${Icons.folder(18)}</span>
                    <input type="text" id="newProjectPathInput" placeholder="Add external project path (e.g. /Users/devanshpc/.../my-app)..." style="flex:1;background:var(--bg-canvas);border:1px solid var(--border-default);padding:8px 12px;border-radius:var(--radius-sm);color:var(--fg-default);font-size:13px;font-family:var(--font-mono);">
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <button class="btn btn--primary btn--sm" onclick="App.addProjectPath()">
                        ${Icons.plus(14)} Add Project
                    </button>
                </div>
            </div>

            <!-- Android Studio Plugin Card -->
            <div class="enforcer-card" style="background:rgba(47, 129, 247, 0.07);border-color:rgba(47, 129, 247, 0.35);">
                <div class="enforcer-card-info">
                    ${Icons.shield(22)}
                    <div>
                        <strong>Android Studio Plugin: Gradle Version Guard</strong>
                        <div style="font-size:12px;color:var(--fg-muted);margin-top:2px;">
                            Pre-sync hook that inspects <code>libs.versions.toml</code> when you open Android Studio and offers 1-click alignment.
                        </div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    <a href="/api/plugin/download" class="btn btn--primary btn--sm" download="gradle-version-guard-1.0.0.zip">
                        ${Icons.download(13)} Download Plugin (.zip)
                    </a>
                </div>
            </div>

            <!-- Global init.d Enforcer Card -->
            <div class="enforcer-card">
                <div class="enforcer-card-info">
                    ${Icons.shield(20)}
                    <div>
                        <strong>Machine-Wide Gradle init.d Enforcer</strong>
                        <div style="font-size:12px;color:var(--fg-muted);">
                            Automatically forces all Gradle builds on this computer to resolve dependencies using the machine baseline.
                        </div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:12px;">
                    <span class="enforcer-status-badge ${enforcerOn ? 'enforcer-status-badge--on' : 'enforcer-status-badge--off'}">
                        ${enforcerOn ? Icons.check(12) + ' Active' : Icons.x(12) + ' Disabled'}
                    </span>
                    <button class="btn btn--ghost btn--sm" onclick="App.toggleEnforcer()">
                        ${enforcerOn ? 'Disable Enforcer' : 'Enable Enforcer'}
                    </button>
                </div>
            </div>

            <!-- Filter chips -->
            <div class="chip-bar">
                <button class="chip ${App.getAlignFilter() === 'drift' ? 'active' : ''}" onclick="App.setAlignFilter('drift')">
                    ⚠️ Mismatches Only (${drifts.length})
                </button>
                <button class="chip ${App.getAlignFilter() === 'priority' ? 'active' : ''}" onclick="App.setAlignFilter('priority')">
                    ⭐ Key Frameworks (${matrix.filter(m => m.is_priority).length})
                </button>
                <button class="chip ${App.getAlignFilter() === 'all' ? 'active' : ''}" onclick="App.setAlignFilter('all')">
                    All Dependencies (${matrix.length})
                </button>
            </div>

            <!-- Drift Matrix Table -->
            <table class="data-table">
                <thead><tr>
                    <th>Library / Key</th>
                    <th>Unified Baseline</th>
                    <th>Status</th>
                    ${projectNames.map(p => `
                        <th>
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                                <span>${escapeHtml(p)}</span>
                                ${projectMap[p] ? `
                                    <button class="btn-icon" title="Unregister project" onclick="App.removeProject('${escapeAttr(projectMap[p])}','${escapeAttr(p)}')">
                                        ${Icons.x(12)}
                                    </button>
                                ` : ''}
                            </div>
                        </th>
                    `).join("")}
                    <th></th>
                </tr></thead>
                <tbody>${matrix.filter(item => {
                    const f = App.getAlignFilter();
                    if (f === 'drift') return item.has_drift;
                    if (f === 'priority') return item.is_priority;
                    return true;
                }).map(item => {
                    const statusHtml = item.has_drift
                        ? `<span class="badge--drift">⚠️ ${item.version_count} Versions</span>`
                        : `<span class="badge--match">✓ Aligned</span>`;

                    const projectCells = projectNames.map(p => {
                        let pVersion = "—";
                        for (const [v, pList] of Object.entries(item.versions || {})) {
                            if (pList.includes(p)) {
                                pVersion = v;
                                break;
                            }
                        }
                        if (pVersion === "—") return `<td class="cell-mono" style="color:var(--fg-subtle);">${pVersion}</td>`;
                        const isMatch = pVersion === item.recommended;
                        return `
                            <td>
                                <span class="${isMatch ? 'badge--match' : 'badge--drift'}">${escapeHtml(pVersion)}</span>
                            </td>`;
                    }).join("");

                    return `
                        <tr>
                            <td class="cell-name">
                                <strong>${escapeHtml(item.key)}</strong>
                            </td>
                            <td>
                                <strong style="color:var(--accent);font-family:var(--font-mono);font-size:13px;">${escapeHtml(item.recommended)}</strong>
                            </td>
                            <td>${statusHtml}</td>
                            ${projectCells}
                            <td>
                                ${item.has_drift ? `
                                    <button class="btn btn--use btn--sm" onclick="App.alignSingleKey('${escapeAttr(item.key)}','${escapeAttr(item.recommended)}')">
                                        Align
                                    </button>
                                ` : ''}
                            </td>
                        </tr>`;
                }).join("")}</tbody>
            </table>`;
    }

    // --- Libraries --------------------------------------------------

    function libraries(data) {
        const allGroups = Object.entries(data || {}).sort((a, b) => b[1].total_size - a[1].total_size);
        if (!allGroups.length) {
            return emptyState("No cached libraries found", "Dependencies will appear here after the first build.");
        }

        const totalArtifacts = allGroups.reduce((s, [, g]) => s + g.artifacts.length, 0);
        const totalSize = allGroups.reduce((s, [, g]) => s + g.total_size, 0);

        return `
            <div class="section-header">
                <h2>Libraries (${allGroups.length} Groups &middot; ${totalArtifacts} Artifacts &middot; ${formatSize(totalSize)})</h2>
                <button class="btn btn--danger btn--sm" onclick="App.deleteSelected('lib-cb')">
                    ${Icons.trash(14)} Delete Selected
                </button>
            </div>

            <div class="search-box">
                ${Icons.search(16)}
                <input type="text" id="libSearch" placeholder="Filter by group or artifact (e.g. androidx, ktor, kotlin)..." oninput="App.filterLibs()">
            </div>

            <table class="data-table" id="libsTable">
                <thead><tr>
                    <th><input type="checkbox" onchange="App.toggleAll(this,'lib-cb')"></th>
                    <th>Group / Artifact</th>
                    <th>Versions</th>
                    <th>Size</th>
                    <th>Category</th>
                    <th></th>
                </tr></thead>
                <tbody>${allGroups.map(([group, info]) => {
                    const versionCount = info.artifacts.reduce((s, a) => s + a.version_count, 0);
                    const groupRows = `
                        <tr class="lib-row" data-group="${group.toLowerCase()}">
                            <td><input type="checkbox" class="lib-cb" data-path="${escapeAttr(info.path)}"></td>
                            <td class="cell-name">
                                <span class="expand-toggle" onclick="App.toggleGroup(this, '${escapeAttr(group)}')">
                                    ${Icons.chevronRight(14)}
                                </span>
                                <strong>${group}</strong>
                                <span class="cell-mono">(${info.artifacts.length})</span>
                            </td>
                            <td>${versionCount}</td>
                            <td class="cell-size">${info.total_size_fmt}</td>
                            <td>${sizeTag(info.total_size)}</td>
                            <td>
                                <button class="btn btn--danger btn--sm" onclick="App.requestDelete('${escapeAttr(info.path)}','${escapeAttr(group)}')">
                                    ${Icons.trash(14)}
                                </button>
                            </td>
                        </tr>`;

                    const subRows = info.artifacts.flatMap(art =>
                        art.versions.map(v => `
                            <tr class="sub-row lib-row" data-group="${group.toLowerCase()}" data-parent="${escapeAttr(group)}">
                                <td></td>
                                <td class="cell-path" style="padding-left:52px">
                                    ${art.name} : <strong>${v.version}</strong>
                                </td>
                                <td>1</td>
                                <td class="cell-size">${v.size_fmt}</td>
                                <td></td>
                                <td>
                                    <div class="action-cell">
                                        <button class="btn btn--use btn--sm" onclick="App.showLibSnippet('${escapeAttr(group)}','${escapeAttr(art.name)}','${escapeAttr(v.version)}')">
                                            ${Icons.code(14)} Use
                                        </button>
                                        <button class="btn btn--danger btn--sm" onclick="App.requestDelete('${escapeAttr(v.path)}','${escapeAttr(art.name + ":" + v.version)}')">
                                            ${Icons.trash(14)}
                                        </button>
                                    </div>
                                </td>
                            </tr>`)
                    ).join("");
                    return groupRows + subRows;
                }).join("")}</tbody>
            </table>`;
    }

    // --- Caches -----------------------------------------------------

    function caches(list) {
        if (!list || !list.length) {
            return emptyState("No cache directories found", "Build caches appear after running Gradle tasks.");
        }
        const total = list.reduce((s, d) => s + d.size, 0);
        return `
            <div class="section-header">
                <h2>Cache Directories (${list.length}) &middot; ${formatSize(total)}</h2>
                <button class="btn btn--danger btn--sm" onclick="App.deleteSelected('cache-cb')">
                    ${Icons.trash(14)} Delete Selected
                </button>
            </div>
            <table class="data-table">
                <thead><tr>
                    <th><input type="checkbox" onchange="App.toggleAll(this,'cache-cb')"></th>
                    <th>Directory</th>
                    <th>Size</th>
                    <th>Category</th>
                    <th>Last Modified</th>
                    <th></th>
                </tr></thead>
                <tbody>${list.map(d => `
                    <tr>
                        <td><input type="checkbox" class="cache-cb" data-path="${escapeAttr(d.path)}"></td>
                        <td class="cell-name">${Icons.folder(16)} ${d.name}</td>
                        <td class="cell-size">${d.size_fmt}</td>
                        <td>${sizeTag(d.size)}</td>
                        <td class="cell-mono">${d.modified}</td>
                        <td><button class="btn btn--danger btn--sm" onclick="App.requestDelete('${escapeAttr(d.path)}','${escapeAttr(d.name)}')">
                            ${Icons.trash(14)}
                        </button></td>
                    </tr>
                `).join("")}</tbody>
            </table>`;
    }

    // --- Daemons ----------------------------------------------------

    function daemons(list) {
        if (!list || !list.length) {
            return emptyState("No daemon data found", "Gradle daemons store logs per version here.");
        }
        const total = list.reduce((s, d) => s + d.size, 0);
        return `
            <div class="section-header">
                <h2>Daemon Data (${list.length}) &middot; ${formatSize(total)}</h2>
                <button class="btn btn--ghost" onclick="App.stopDaemons()">
                    ${Icons.square(14)} Stop All Daemons
                </button>
            </div>
            <table class="data-table">
                <thead><tr>
                    <th>Version</th>
                    <th>Size</th>
                    <th>Last Modified</th>
                    <th></th>
                </tr></thead>
                <tbody>${list.map(d => `
                    <tr>
                        <td class="cell-name">${Icons.activity(16)} ${d.name}</td>
                        <td class="cell-size">${d.size_fmt}</td>
                        <td class="cell-mono">${d.modified}</td>
                        <td><button class="btn btn--danger btn--sm" onclick="App.requestDelete('${escapeAttr(d.path)}','${escapeAttr(d.name)}')">
                            ${Icons.trash(14)}
                        </button></td>
                    </tr>
                `).join("")}</tbody>
            </table>`;
    }

    // --- Kotlin/Native ----------------------------------------------

    function konan(list) {
        if (!list || !list.length) {
            return emptyState("No Kotlin/Native cache found", "The ~/.konan directory is created when KMP targets native platforms.");
        }
        const total = list.reduce((s, d) => s + d.size, 0);
        return `
            <div class="section-header">
                <h2>Kotlin/Native Cache (${list.length}) &middot; ${formatSize(total)}</h2>
                <button class="btn btn--danger btn--sm" onclick="App.deleteSelected('konan-cb')">
                    ${Icons.trash(14)} Delete Selected
                </button>
            </div>
            <table class="data-table">
                <thead><tr>
                    <th><input type="checkbox" onchange="App.toggleAll(this,'konan-cb')"></th>
                    <th>Directory</th>
                    <th>Size</th>
                    <th>Category</th>
                    <th>Last Modified</th>
                    <th></th>
                </tr></thead>
                <tbody>${list.map(d => `
                    <tr>
                        <td><input type="checkbox" class="konan-cb" data-path="${escapeAttr(d.path)}"></td>
                        <td class="cell-name">${Icons.wrench(16)} ${d.name}</td>
                        <td class="cell-size">${d.size_fmt}</td>
                        <td>${sizeTag(d.size)}</td>
                        <td class="cell-mono">${d.modified}</td>
                        <td><button class="btn btn--danger btn--sm" onclick="App.requestDelete('${escapeAttr(d.path)}','${escapeAttr(d.name)}')">
                            ${Icons.trash(14)}
                        </button></td>
                    </tr>
                `).join("")}</tbody>
            </table>`;
    }

    // ================================================================
    // SNIPPET GENERATORS
    // ================================================================

    /**
     * Parse a distribution directory name into version and type.
     * e.g. "gradle-8.14-bin" → { version: "8.14", type: "bin" }
     *      "gradle-8.14-all" → { version: "8.14", type: "all" }
     */
    function parseDistName(name) {
        const match = name.match(/^gradle-(.+?)-(bin|all)$/);
        if (match) return { version: match[1], type: match[2] };
        // Fallback: try extracting any version-like string
        const fallback = name.match(/(\d+\.\d+[\w.-]*)/);
        return {
            version: fallback ? fallback[1] : name,
            type: "bin",
        };
    }

    /**
     * Generate gradle-wrapper.properties content for a given dist name.
     */
    function wrapperPropsContent(distName) {
        const { version, type } = parseDistName(distName);
        return [
            `distributionBase=GRADLE_USER_HOME`,
            `distributionPath=wrapper/dists`,
            `distributionUrl=https\\://services.gradle.org/distributions/gradle-${version}-${type}.zip`,
            `networkTimeout=10000`,
            `validateDistributionUrl=true`,
            `zipStoreBase=GRADLE_USER_HOME`,
            `zipStorePath=wrapper/dists`,
        ].join("\n");
    }

    /**
     * Render the snippet modal for a Framework Suite version.
     */
    function suiteSnippetModal(suiteId, suiteName, version, tomlSnippet) {
        return `
            <div class="modal modal--wide">
                <div class="snippet-header">
                    <div class="snippet-icon">${Icons.code(20)}</div>
                    <div>
                        <h3>${escapeHtml(suiteName)} &middot; v${escapeHtml(version)}</h3>
                    </div>
                </div>
                <div class="snippet-subtitle">
                    Add this to your <strong>gradle/libs.versions.toml</strong> to use this framework version across your project:
                </div>

                <div class="code-block-wrapper">
                    <div class="format-tabs">
                        <button class="format-tab active">libs.versions.toml</button>
                    </div>
                    <div class="code-block" id="snippetCode">${escapeHtml(tomlSnippet)}</div>
                    <button class="copy-btn" onclick="App.copySnippet()">
                        ${Icons.copy(13)} Copy to Clipboard
                    </button>
                </div>

                <div class="modal-actions">
                    <button class="btn btn--ghost" onclick="App.closeSnippet()">Close</button>
                </div>
            </div>`;
    }

    /**
     * Render the snippet modal for a Gradle wrapper distribution.
     */
    function wrapperSnippetModal(distName) {
        const content = wrapperPropsContent(distName);
        const { version, type } = parseDistName(distName);

        return `
            <div class="modal modal--wide">
                <div class="snippet-header">
                    <div class="snippet-icon">${Icons.fileText(20)}</div>
                    <div>
                        <h3>Gradle Wrapper Config</h3>
                    </div>
                </div>
                <div class="snippet-subtitle">
                    Paste this into your project's
                    <strong>gradle/wrapper/gradle-wrapper.properties</strong>
                    to use Gradle <strong>${escapeHtml(version)}-${type}</strong>.
                </div>

                <div class="code-block-wrapper">
                    <div class="format-tabs">
                        <button class="format-tab active">gradle-wrapper.properties</button>
                    </div>
                    <div class="code-block" id="snippetCode">${escapeHtml(content)}</div>
                    <button class="copy-btn" onclick="App.copySnippet()">
                        ${Icons.copy(13)} Copy
                    </button>
                </div>

                <div class="modal-actions">
                    <button class="btn btn--ghost" onclick="App.closeSnippet()">Close</button>
                </div>
            </div>`;
    }

    /**
     * Generate dependency declarations in multiple formats.
     */
    function libDeclarations(group, artifact, version) {
        const coord = `${group}:${artifact}:${version}`;

        // Sanitize for TOML key: replace dots and hyphens
        const tomlKey = artifact.replace(/[._]/g, "-");
        const tomlGroupKey = group.replace(/\./g, "-").replace(/_/g, "-");

        return {
            "Kotlin DSL": `implementation("${coord}")`,

            "Groovy DSL": `implementation '${coord}'`,

            "Version Catalog": [
                `# gradle/libs.versions.toml`,
                ``,
                `[versions]`,
                `${tomlKey} = "${version}"`,
                ``,
                `[libraries]`,
                `${tomlGroupKey}-${tomlKey} = { group = "${group}", name = "${artifact}", version.ref = "${tomlKey}" }`,
            ].join("\n"),

            "Maven": [
                `<dependency>`,
                `    <groupId>${group}</groupId>`,
                `    <artifactId>${artifact}</artifactId>`,
                `    <version>${version}</version>`,
                `</dependency>`,
            ].join("\n"),
        };
    }

    /**
     * Render the snippet modal for a library dependency.
     */
    function libSnippetModal(group, artifact, version) {
        const formats = libDeclarations(group, artifact, version);
        const formatNames = Object.keys(formats);
        const defaultFormat = formatNames[0];

        return `
            <div class="modal modal--wide">
                <div class="snippet-header">
                    <div class="snippet-icon">${Icons.library(20)}</div>
                    <div>
                        <h3>${escapeHtml(artifact)}</h3>
                    </div>
                </div>
                <div class="snippet-subtitle">
                    <strong>${escapeHtml(group)}:${escapeHtml(artifact)}:${escapeHtml(version)}</strong>
                    — Copy the dependency declaration for your build system.
                </div>

                <div class="code-block-wrapper">
                    <div class="format-tabs">
                        ${formatNames.map((name, i) => `
                            <button class="format-tab ${i === 0 ? 'active' : ''}"
                                    onclick="App.switchFormat(this, '${escapeAttr(name)}')"
                                    data-format="${escapeAttr(name)}">
                                ${escapeHtml(name)}
                            </button>
                        `).join("")}
                    </div>
                    <div class="code-block" id="snippetCode">${escapeHtml(formats[defaultFormat])}</div>
                    <button class="copy-btn" onclick="App.copySnippet()">
                        ${Icons.copy(13)} Copy
                    </button>
                </div>

                <div class="modal-actions">
                    <button class="btn btn--ghost" onclick="App.closeSnippet()">Close</button>
                </div>
            </div>`;
    }

    // ================================================================
    // PROPERTIES BUILDER
    // ================================================================

    /**
     * Render a single flag card.
     * `selectedFlags` is a Map<key, value> of currently selected flags.
     */
    function flagCard(flag, selectedFlags) {
        const isSelected = selectedFlags.has(flag.key);
        const currentVal = selectedFlags.get(flag.key) ?? flag.default ?? "";

        let valueInput = "";
        if (isSelected) {
            if (flag.type === "boolean") {
                // No extra input needed — toggle is the value
            } else if (flag.type === "select" && flag.options) {
                const opts = flag.options.map(o =>
                    `<option value="${escapeAttr(o)}" ${o === currentVal ? 'selected' : ''}>${o}</option>`
                ).join("");
                valueInput = `
                    <div class="flag-value-input">
                        <label>Value:</label>
                        <select onchange="App.setFlagValue('${escapeAttr(flag.key)}', this.value)">${opts}</select>
                    </div>`;
            } else {
                valueInput = `
                    <div class="flag-value-input">
                        <label>Value:</label>
                        <input type="${flag.type === 'number' ? 'number' : 'text'}"
                               value="${escapeAttr(currentVal)}"
                               placeholder="${escapeAttr(flag.default || '')}"
                               onchange="App.setFlagValue('${escapeAttr(flag.key)}', this.value)">
                    </div>`;
            }
        }

        const metaBadges = [];
        if (flag.recommended) {
            metaBadges.push(`<span class="flag-badge flag-badge--rec">${Icons.star(10)} Recommended</span>`);
        }
        metaBadges.push(`<span class="flag-badge flag-badge--cat">${escapeHtml(flag.category)}</span>`);
        if (flag.since) {
            metaBadges.push(`<span class="flag-badge flag-badge--src">${escapeHtml(flag.since)}</span>`);
        }
        if (flag.source === "custom") {
            metaBadges.push(`<span class="flag-badge flag-badge--src">Custom</span>`);
        }

        const linkHtml = flag.link
            ? `<a class="flag-link" href="${flag.link}" target="_blank" rel="noopener">${Icons.externalLink(10)} Docs</a>`
            : "";

        const removeCustomBtn = flag.source === "custom"
            ? `<button class="btn btn--danger btn--sm" style="padding:2px 6px;margin-left:auto;" title="Delete custom flag" onclick="App.removeCustomFlag('${escapeAttr(flag.key)}')">${Icons.trash(12)}</button>`
            : "";

        return `
            <div class="flag-card ${isSelected ? 'selected' : ''}" data-key="${escapeAttr(flag.key)}"
                 data-category="${escapeAttr(flag.category.toLowerCase())}"
                 data-searchable="${escapeAttr((flag.key + ' ' + flag.description + ' ' + flag.category).toLowerCase())}">
                <div class="flag-toggle">
                    <input type="checkbox" ${isSelected ? 'checked' : ''}
                           onchange="App.toggleFlag('${escapeAttr(flag.key)}', this.checked)">
                </div>
                <div class="flag-body">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span class="flag-key">${escapeHtml(flag.key)}</span>
                        ${removeCustomBtn}
                    </div>
                    <div class="flag-desc">${escapeHtml(flag.description)}</div>
                    <div class="flag-meta">${metaBadges.join("")} ${linkHtml}</div>
                    ${valueInput}
                </div>
            </div>`;
    }

    /**
     * Render the full Properties Builder tab.
     */
    function propertiesBuilder(flags, categories, selectedFlags, activeCategory, searchQuery) {
        const filtered = flags.filter(f => {
            if (activeCategory && f.category !== activeCategory) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const haystack = (f.key + " " + f.description + " " + f.category).toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });

        // Generate preview content
        const previewLines = [];
        let lastCat = "";
        const sortedSelected = [...selectedFlags.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        // Group by category for nice output
        const flagMap = {};
        flags.forEach(f => flagMap[f.key] = f);
        const grouped = {};
        for (const [key, val] of sortedSelected) {
            const cat = flagMap[key]?.category || "Other";
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ key, val, flag: flagMap[key] });
        }
        for (const [cat, entries] of Object.entries(grouped)) {
            if (previewLines.length > 0) previewLines.push("");
            previewLines.push(`# ${cat}`);
            for (const { key, val, flag } of entries) {
                previewLines.push(`${key}=${val}`);
            }
        }
        const previewText = previewLines.length > 0
            ? previewLines.join("\n")
            : "";

        return `
            <div class="section-header">
                <h2>Gradle Properties Builder (${flags.length} flags)</h2>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn--ghost btn--sm" onclick="App.selectRecommended()">
                        ${Icons.star(14)} Select Recommended
                    </button>
                    <button class="btn btn--ghost btn--sm" onclick="App.openAddFlagModal()">
                        ${Icons.plus(14)} Add Flag
                    </button>
                    <button class="btn btn--ghost btn--sm" onclick="App.openSyncModal()">
                        ${Icons.refresh(14)} Sync / Update
                    </button>
                    <button class="btn btn--ghost btn--sm" onclick="App.clearAllFlags()">
                        ${Icons.x(14)} Clear All
                    </button>
                </div>
            </div>

            <div class="builder-layout">
                <!-- Left: flags list -->
                <div>
                    <div class="search-box">
                        ${Icons.search(16)}
                        <input type="text" id="flagSearch"
                               placeholder="Search flags by name, description, or category..."
                               value="${escapeAttr(searchQuery || '')}"
                               oninput="App.filterFlags(this.value)">
                    </div>

                    <div class="chip-bar">
                        <button class="chip ${!activeCategory ? 'active' : ''}"
                                onclick="App.filterCategory('')">All (${flags.length})</button>
                        ${categories.map(cat => {
                            const count = flags.filter(f => f.category === cat).length;
                            return `
                            <button class="chip ${activeCategory === cat ? 'active' : ''}"
                                    onclick="App.filterCategory('${escapeAttr(cat)}')">${escapeHtml(cat)} (${count})</button>
                            `;
                        }).join("")}
                    </div>

                    <div class="flag-list">
                        ${filtered.length > 0
                            ? filtered.map(f => flagCard(f, selectedFlags)).join("")
                            : `<div class="empty-state">${Icons.search(32)}<div><strong>No flags match</strong><br>Try a different search or category.</div></div>`
                        }
                    </div>
                </div>

                <!-- Right: live preview -->
                <div class="preview-panel">
                    <div class="preview-card">
                        <div class="preview-header">
                            <h3>${Icons.fileText(14)} gradle.properties</h3>
                            <span class="preview-count">${selectedFlags.size} selected</span>
                        </div>
                        ${previewText
                            ? `<div class="preview-body" id="propsPreview">${escapeHtml(previewText)}</div>`
                            : `<div class="preview-empty">Select flags to generate your gradle.properties</div>`
                        }
                    </div>
                    ${previewText ? `
                        <div style="margin-top:10px;display:flex;gap:8px">
                            <button class="btn btn--primary btn--sm" onclick="App.copyProperties()" style="flex:1">
                                ${Icons.copy(14)} Copy to Clipboard
                            </button>
                            <button class="btn btn--ghost btn--sm" onclick="App.downloadProperties()">
                                ${Icons.download(14)} Download
                            </button>
                        </div>
                    ` : ""}
                </div>
            </div>`;
    }

    /**
     * Modal to add a custom flag.
     */
    function addFlagModal(categories) {
        return `
            <div class="modal modal--wide">
                <div class="snippet-header">
                    <div class="snippet-icon">${Icons.plus(20)}</div>
                    <div>
                        <h3>Add Custom Property Flag</h3>
                    </div>
                </div>
                <div class="snippet-subtitle">
                    Add a new Gradle, Android, or Compose flag to your local registry.
                </div>

                <form id="addFlagForm" onsubmit="App.saveCustomFlag(event)">
                    <div style="display:flex;flex-direction:column;gap:12px;text-align:left;margin-bottom:20px;">
                        <div>
                            <label style="font-size:12px;color:var(--fg-muted);display:block;margin-bottom:4px;">Property Key *</label>
                            <input type="text" id="newFlagKey" required placeholder="e.g. android.enableR8.fullMode"
                                   style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-default);background:var(--bg-inset);color:var(--fg-default);font-family:var(--font-mono);font-size:13px;">
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                            <div>
                                <label style="font-size:12px;color:var(--fg-muted);display:block;margin-bottom:4px;">Category</label>
                                <input type="text" id="newFlagCategory" list="categoryOptions" placeholder="e.g. Android"
                                       style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-default);background:var(--bg-inset);color:var(--fg-default);font-size:13px;">
                                <datalist id="categoryOptions">
                                    ${categories.map(c => `<option value="${escapeAttr(c)}">`).join('')}
                                </datalist>
                            </div>
                            <div>
                                <label style="font-size:12px;color:var(--fg-muted);display:block;margin-bottom:4px;">Type</label>
                                <select id="newFlagType" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-default);background:var(--bg-inset);color:var(--fg-default);font-size:13px;">
                                    <option value="boolean">Boolean (true/false)</option>
                                    <option value="string">String / Value</option>
                                    <option value="number">Number</option>
                                    <option value="select">Select Options</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label style="font-size:12px;color:var(--fg-muted);display:block;margin-bottom:4px;">Default Value</label>
                            <input type="text" id="newFlagDefault" placeholder="e.g. true or -Xmx4g"
                                   style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-default);background:var(--bg-inset);color:var(--fg-default);font-family:var(--font-mono);font-size:13px;">
                        </div>
                        <div>
                            <label style="font-size:12px;color:var(--fg-muted);display:block;margin-bottom:4px;">Description *</label>
                            <textarea id="newFlagDesc" required rows="2" placeholder="Explain what this flag does and how it affects builds..."
                                      style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-default);background:var(--bg-inset);color:var(--fg-default);font-size:13px;resize:vertical;"></textarea>
                        </div>
                        <div>
                            <label style="font-size:12px;color:var(--fg-muted);display:block;margin-bottom:4px;">Documentation URL (optional)</label>
                            <input type="url" id="newFlagLink" placeholder="https://developer.android.com/..."
                                   style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-default);background:var(--bg-inset);color:var(--fg-default);font-size:13px;">
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn--ghost" onclick="App.closeSnippet()">Cancel</button>
                        <button type="submit" class="btn btn--primary">${Icons.check(14)} Save Flag</button>
                    </div>
                </form>
            </div>`;
    }

    /**
     * Modal to sync flags from URL or JSON.
     */
    function syncFlagsModal() {
        return `
            <div class="modal modal--wide">
                <div class="snippet-header">
                    <div class="snippet-icon">${Icons.refresh(20)}</div>
                    <div>
                        <h3>Dynamic Flag Sync & Update</h3>
                    </div>
                </div>
                <div class="snippet-subtitle">
                    Keep your flags registry updated with latest flags from documentation or remote repos.
                </div>

                <div style="display:flex;flex-direction:column;gap:16px;text-align:left;margin-bottom:20px;">
                    <div>
                        <label style="font-size:12px;color:var(--fg-muted);display:block;margin-bottom:4px;">Sync from Documentation / Raw JSON URL</label>
                        <div style="display:flex;gap:8px;">
                            <input type="url" id="syncUrlInput" placeholder="https://raw.githubusercontent.com/.../flags.json"
                                   style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border-default);background:var(--bg-inset);color:var(--fg-default);font-size:13px;">
                            <button class="btn btn--primary btn--sm" onclick="App.syncFromUrl()">${Icons.download(14)} Sync</button>
                        </div>
                    </div>

                    <div style="text-align:center;color:var(--fg-subtle);font-size:12px;">— OR PASTE FLAGS JSON —</div>

                    <div>
                        <label style="font-size:12px;color:var(--fg-muted);display:block;margin-bottom:4px;">Import JSON</label>
                        <textarea id="importJsonInput" rows="5" placeholder='[{"key": "my.new.flag", "category": "Android", "description": "...", "default": "true"}]'
                                  style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border-default);background:var(--bg-inset);color:var(--fg-default);font-family:var(--font-mono);font-size:12px;resize:vertical;"></textarea>
                        <div style="margin-top:8px;display:flex;justify-content:flex-end;">
                            <button class="btn btn--ghost btn--sm" onclick="App.importFromJson()">${Icons.check(14)} Import JSON</button>
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    <button type="button" class="btn btn--ghost" onclick="App.closeSnippet()">Close</button>
                </div>
            </div>`;
    }

    // --- Shared pieces ----------------------------------------------

    function emptyState(title, subtitle) {
        return `<div class="empty-state">${Icons.folder(32)}<div><strong>${title}</strong><br>${subtitle}</div></div>`;
    }

    function loading() {
        return `<div class="loading-state"><div class="spinner"></div>Scanning Gradle home&hellip;</div>`;
    }

    function deleteModal(message) {
        return `
            <div class="modal">
                <div class="modal-icon">${Icons.alertTriangle(24)}</div>
                <h3>Confirm Deletion</h3>
                <p>${message}</p>
                <div class="modal-actions">
                    <button class="btn btn--ghost" onclick="App.closeModal()">Cancel</button>
                    <button class="btn btn--primary" style="background:var(--danger);border-color:var(--danger)" onclick="App.confirmDelete()">
                        ${Icons.trash(14)} Delete
                    </button>
                </div>
            </div>`;
    }

    // --- Public API -------------------------------------------------

    return {
        overview,
        distributions,
        libraries,
        caches,
        daemons,
        konan,
        loading,
        deleteModal,
        formatSize,
        // Snippet generators
        suiteSnippetModal,
        wrapperSnippetModal,
        libSnippetModal,
        libDeclarations,
        // Projects alignment
        alignment,
        // Properties builder
        propertiesBuilder,
        addFlagModal,
        syncFlagsModal,
    };
})();
