/**
 * app.js — Main application controller.
 *
 * Manages state, API communication, tab switching, search/filter,
 * delete workflow, snippet modals, clipboard copy, properties builder,
 * and dynamic flag sync.
 *
 * Exposes the global `App` object consumed by onclick handlers in
 * components.js templates.
 */

const App = (() => {

    // --- State ------------------------------------------------------

    let data = {};              // Full scan payload from /api/scan
    let currentTab = "distributions";
    let pendingDelete = null;   // Array of { path, name } to delete

    // Snippet modal state
    let snippetFormats = null;  // { "Kotlin DSL": "...", "Groovy DSL": "...", ... }
    let activeFormat = null;    // Current selected format name

    // Properties builder state
    let flagsData = [];             // Full flags list from /api/flags
    let flagCategories = [];        // Unique category names
    let selectedFlags = new Map();  // Map<key, value> of currently selected flags
    let flagCategory = "";          // Active category filter (empty = all)
    let flagSearch = "";            // Current search query

    // Projects & Alignment state
    let projectsData = {};          // Payload from /api/projects
    let alignFilter = "drift";      // 'drift' | 'priority' | 'all'
    let libViewMode = "suites";     // 'suites' | 'sprawl' | 'all'

    // --- DOM refs ----------------------------------------------------

    const $ = (id) => document.getElementById(id);

    // --- API client -------------------------------------------------

    async function api(endpoint, method = "GET", body = null) {
        const opts = { method };
        if (body) {
            opts.headers = { "Content-Type": "application/json" };
            opts.body = JSON.stringify(body);
        }
        const res = await fetch("/api/" + endpoint, opts);
        return res.json();
    }

    // --- Toast ------------------------------------------------------

    let toastTimer = null;

    function showToast(message, variant = "success", duration = 3500) {
        const el = $("toast");
        el.className = `toast toast--${variant}`;
        el.innerHTML = (variant === "success" ? Icons.check(16) :
                        variant === "error"   ? Icons.x(16) :
                        Icons.info(16)) + " " + message;
        el.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove("show"), duration);
    }

    // --- Tab switching ----------------------------------------------

    async function switchTab(tab) {
        currentTab = tab;
        document.querySelectorAll(".tab-btn").forEach(btn =>
            btn.classList.toggle("active", btn.dataset.tab === tab));
        if (tab === "properties" && flagsData.length === 0) {
            await loadFlags(true);
        } else if (tab === "alignment" && (!projectsData || !projectsData.projects || !projectsData.projects.length)) {
            $("tabContent").innerHTML = Components.loading();
            await loadProjects(true);
        }
        renderTab();
    }

    // --- Render ------------------------------------------------------

    function renderOverview() {
        $("overview").innerHTML = Components.overview(data.overview);
    }

    function renderTab() {
        const target = $("tabContent");
        switch (currentTab) {
            case "distributions": target.innerHTML = Components.distributions(data.distributions); break;
            case "alignment":     target.innerHTML = Components.alignment(projectsData);            break;
            case "libraries":     target.innerHTML = Components.libraries(data.libraries);         break;
            case "caches":        target.innerHTML = Components.caches(data.caches);               break;
            case "daemons":       target.innerHTML = Components.daemons(data.daemons);             break;
            case "konan":         target.innerHTML = Components.konan(data.konan);                 break;
            case "properties":    target.innerHTML = Components.propertiesBuilder(flagsData, flagCategories, selectedFlags, flagCategory, flagSearch); break;
        }
    }

    // --- Refresh / Scan ---------------------------------------------

    async function refreshAll() {
        $("tabContent").innerHTML = Components.loading();
        try {
            data = await api("scan");
            renderOverview();
            renderTab();
            showToast("Scan complete");
        } catch (err) {
            showToast("Scan failed: " + err.message, "error");
        }
    }

    // --- Checkbox helpers -------------------------------------------

    function toggleAll(master, className) {
        document.querySelectorAll("." + className).forEach(cb =>
            cb.checked = master.checked);
    }

    // --- Library group expand/collapse ------------------------------

    function toggleGroup(el, groupName) {
        const isOpen = el.classList.contains("open");
        el.classList.toggle("open", !isOpen);
        let next = el.closest("tr").nextElementSibling;
        while (next && next.classList.contains("sub-row") && next.dataset.parent === groupName) {
            next.classList.toggle("visible", !isOpen);
            next = next.nextElementSibling;
        }
    }

    // --- Library search filter --------------------------------------

    function filterLibs() {
        const q = ($("libSearch")?.value || "").toLowerCase();
        document.querySelectorAll(".lib-row").forEach(row => {
            const group = row.dataset.group || "";
            row.style.display = group.includes(q) ? "" : "none";
        });
    }

    // ================================================================
    // DELETE WORKFLOW
    // ================================================================

    function requestDelete(path, name) {
        pendingDelete = [{ path, name }];
        showModal(`Are you sure you want to delete <strong>${name}</strong>? This action cannot be undone.`);
    }

    function requestDeleteMultiple(paths, name) {
        pendingDelete = paths.map(p => ({ path: p, name: p.split("/").pop() }));
        showModal(`Are you sure you want to delete <strong>${name}</strong>? This will remove all associated cached artifacts across the suite and cannot be undone.`);
    }

    function deleteSuiteVersion(suiteName, version, pathsJson) {
        try {
            const paths = typeof pathsJson === "string" ? JSON.parse(pathsJson) : pathsJson;
            if (!paths || !paths.length) return;
            requestDeleteMultiple(paths, `${suiteName} v${version} (${paths.length} artifacts)`);
        } catch (err) {
            console.error(err);
        }
    }

    function deleteSelected(className) {
        const selected = [...document.querySelectorAll("." + className + ":checked")]
            .map(cb => ({ path: cb.dataset.path, name: cb.dataset.path.split("/").pop() }));
        if (!selected.length) {
            showToast("No items selected", "info");
            return;
        }
        pendingDelete = selected;
        showModal(`Delete <strong>${selected.length}</strong> selected item(s)? This action cannot be undone.`);
    }

    function showModal(message) {
        const backdrop = $("modalBackdrop");
        backdrop.innerHTML = Components.deleteModal(message);
        backdrop.classList.add("show");
    }

    function closeModal() {
        pendingDelete = null;
        $("modalBackdrop").classList.remove("show");
    }

    async function confirmDelete() {
        if (!pendingDelete) return;
        const paths = pendingDelete.map(x => x.path);
        closeModal();
        try {
            const res = await api("delete", "POST", { paths });
            if (res.success) {
                showToast(`Deleted ${res.deleted} item(s), freed ${res.freed_fmt}`);
                refreshAll();
            } else {
                showToast("Error: " + (res.error || "Unknown"), "error");
            }
        } catch (err) {
            showToast("Delete failed: " + err.message, "error");
        }
    }

    // ================================================================
    // SNIPPET MODALS
    // ================================================================

    function showSuiteSnippet(suiteId, suiteName, version) {
        const suite = (data.suites || []).find(s => s.id === suiteId);
        let snippet = "";
        if (suite) {
            const vObj = suite.versions.find(v => v.version === version);
            if (vObj) snippet = vObj.toml_snippet;
        }
        if (!snippet) {
            snippet = `[versions]\n${suiteId} = "${version}"\n`;
        }
        snippetFormats = null;
        activeFormat = null;
        const backdrop = $("snippetBackdrop");
        backdrop.innerHTML = Components.suiteSnippetModal(suiteId, suiteName, version, snippet);
        backdrop.classList.add("show");
    }

    function showWrapperSnippet(distName) {
        snippetFormats = null;
        activeFormat = null;
        const backdrop = $("snippetBackdrop");
        backdrop.innerHTML = Components.wrapperSnippetModal(distName);
        backdrop.classList.add("show");
    }

    function showLibSnippet(group, artifact, version) {
        snippetFormats = Components.libDeclarations(group, artifact, version);
        activeFormat = Object.keys(snippetFormats)[0];
        const backdrop = $("snippetBackdrop");
        backdrop.innerHTML = Components.libSnippetModal(group, artifact, version);
        backdrop.classList.add("show");
    }

    function switchFormat(tabEl, formatName) {
        if (!snippetFormats || !snippetFormats[formatName]) return;

        activeFormat = formatName;

        tabEl.closest(".format-tabs").querySelectorAll(".format-tab").forEach(t =>
            t.classList.toggle("active", t.dataset.format === formatName));

        const codeEl = $("snippetCode");
        if (codeEl) {
            codeEl.textContent = snippetFormats[formatName];
        }

        const copyBtn = document.querySelector(".copy-btn");
        if (copyBtn) {
            copyBtn.classList.remove("copied");
            copyBtn.innerHTML = Icons.copy(13) + " Copy";
        }
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
        }
    }

    async function copySnippet() {
        const codeEl = $("snippetCode");
        if (!codeEl) return;

        const text = codeEl.textContent;
        await copyToClipboard(text);

        const copyBtn = document.querySelector(".copy-btn");
        if (copyBtn) {
            copyBtn.classList.add("copied");
            copyBtn.innerHTML = Icons.check(13) + " Copied";
            setTimeout(() => {
                copyBtn.classList.remove("copied");
                copyBtn.innerHTML = Icons.copy(13) + " Copy";
            }, 2000);
        }

        showToast("Copied to clipboard");
    }

    function closeSnippet() {
        snippetFormats = null;
        activeFormat = null;
        $("snippetBackdrop").classList.remove("show");
    }

    // ================================================================
    // PROPERTIES BUILDER & DYNAMIC FLAGS
    // ================================================================

    async function loadFlags(silent = false) {
        try {
            const res = await api("flags");
            flagsData = res.flags || [];
            flagCategories = res.categories || [];
            if (!silent && currentTab === "properties") {
                renderTab();
            }
        } catch (err) {
            showToast("Failed to load flags: " + err.message, "error");
        }
    }

    function filterFlags(q) {
        flagSearch = q;
        renderTab();
        const input = $("flagSearch");
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }

    function filterCategory(cat) {
        flagCategory = cat;
        renderTab();
    }

    function toggleFlag(key, checked) {
        if (checked) {
            const flag = flagsData.find(f => f.key === key);
            let val = flag?.default || "true";
            if (flag?.type === "boolean") {
                val = "true";
            }
            selectedFlags.set(key, val);
        } else {
            selectedFlags.delete(key);
        }
        renderTab();
    }

    function setFlagValue(key, value) {
        selectedFlags.set(key, value);
        updatePropsPreview();
    }

    function updatePropsPreview() {
        const sortedSelected = [...selectedFlags.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        const flagMap = {};
        flagsData.forEach(f => flagMap[f.key] = f);
        const grouped = {};
        for (const [key, val] of sortedSelected) {
            const cat = flagMap[key]?.category || "Other";
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ key, val });
        }
        const previewLines = [];
        for (const [cat, entries] of Object.entries(grouped)) {
            if (previewLines.length > 0) previewLines.push("");
            previewLines.push(`# ${cat}`);
            for (const { key, val } of entries) {
                previewLines.push(`${key}=${val}`);
            }
        }
        const previewText = previewLines.join("\n");
        const previewEl = $("propsPreview");
        if (previewEl) {
            previewEl.textContent = previewText;
        }
    }

    function selectRecommended() {
        flagsData.forEach(f => {
            if (f.recommended) {
                selectedFlags.set(f.key, f.default || "true");
            }
        });
        renderTab();
        showToast("Selected recommended flags");
    }

    function clearAllFlags() {
        selectedFlags.clear();
        renderTab();
        showToast("Cleared all selected flags");
    }

    async function copyProperties() {
        const codeEl = $("propsPreview");
        if (!codeEl || !codeEl.textContent) {
            showToast("No flags selected to copy", "info");
            return;
        }
        await copyToClipboard(codeEl.textContent);
        showToast("gradle.properties copied to clipboard");
    }

    function downloadProperties() {
        const codeEl = $("propsPreview");
        if (!codeEl || !codeEl.textContent) {
            showToast("No flags selected to download", "info");
            return;
        }
        const blob = new Blob([codeEl.textContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "gradle.properties";
        a.click();
        URL.revokeObjectURL(url);
        showToast("Downloaded gradle.properties");
    }

    function openAddFlagModal() {
        const backdrop = $("snippetBackdrop");
        backdrop.innerHTML = Components.addFlagModal(flagCategories);
        backdrop.classList.add("show");
    }

    async function saveCustomFlag(e) {
        e.preventDefault();
        const key = $("newFlagKey").value.trim();
        const category = $("newFlagCategory").value.trim() || "Custom";
        const type = $("newFlagType").value;
        const defaultValue = $("newFlagDefault").value.trim();
        const description = $("newFlagDesc").value.trim();
        const link = $("newFlagLink").value.trim();

        if (!key || !description) {
            showToast("Key and description are required", "error");
            return;
        }

        const flag = {
            key,
            category,
            type,
            default: defaultValue,
            description,
            link: link || undefined,
            recommended: false,
        };

        try {
            const res = await api("flags/add", "POST", { flag });
            if (res.success) {
                showToast(`Flag "${key}" saved`);
                closeSnippet();
                await loadFlags(true);
                renderTab();
            } else {
                showToast("Error: " + (res.error || "Failed"), "error");
            }
        } catch (err) {
            showToast("Failed to save flag: " + err.message, "error");
        }
    }

    async function removeCustomFlag(key) {
        if (!confirm(`Delete custom flag "${key}"?`)) return;
        try {
            const res = await api("flags/remove", "POST", { key });
            if (res.success) {
                selectedFlags.delete(key);
                showToast(`Flag "${key}" deleted`);
                await loadFlags(true);
                renderTab();
            } else {
                showToast("Error: " + (res.error || "Failed"), "error");
            }
        } catch (err) {
            showToast("Failed: " + err.message, "error");
        }
    }

    function openSyncModal() {
        const backdrop = $("snippetBackdrop");
        backdrop.innerHTML = Components.syncFlagsModal();
        backdrop.classList.add("show");
    }

    async function syncFromUrl() {
        const url = $("syncUrlInput").value.trim();
        if (!url) {
            showToast("Please enter a URL", "info");
            return;
        }
        showToast("Fetching remote flags...", "info");
        try {
            const res = await api("flags/sync-url", "POST", { url });
            if (res.success) {
                showToast(`Synced ${res.count} flags from URL`);
                closeSnippet();
                await loadFlags(true);
                renderTab();
            } else {
                showToast("Sync error: " + (res.error || "Failed"), "error");
            }
        } catch (err) {
            showToast("Sync failed: " + err.message, "error");
        }
    }

    async function importFromJson() {
        const raw = $("importJsonInput").value.trim();
        if (!raw) {
            showToast("Please paste JSON", "info");
            return;
        }
        try {
            let parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) && parsed.flags) parsed = parsed.flags;
            if (!Array.isArray(parsed)) throw new Error("JSON must be an array of flag objects");
            const res = await api("flags/import", "POST", { flags: parsed });
            if (res.success) {
                showToast(`Imported ${res.count} flags`);
                closeSnippet();
                await loadFlags(true);
                renderTab();
            } else {
                showToast("Import error: " + (res.error || "Failed"), "error");
            }
        } catch (err) {
            showToast("Invalid JSON: " + err.message, "error");
        }
    }

    // ================================================================
    // PROJECTS & ALIGNMENT
    // ================================================================

    async function loadProjects(silent = false) {
        try {
            const res = await api("projects");
            projectsData = res || {};
            if (currentTab === "alignment") {
                renderTab();
            }
        } catch (err) {
            showToast("Failed to load projects: " + err.message, "error");
        }
    }

    function getAlignFilter() { return alignFilter; }
    function setAlignFilter(f) { alignFilter = f; renderTab(); }

    function getLibViewMode() { return libViewMode; }
    function setLibViewMode(m) { libViewMode = m; renderTab(); }

    async function alignAllProjects() {
        if (!projectsData || !projectsData.projects || !projectsData.projects.length) return;
        const count = projectsData.projects.length;
        if (!confirm(`Apply unified baseline versions to all ${count} projects?\n\nBackup copies (.bak) will be created automatically for safety.`)) {
            return;
        }

        showToast("Aligning all projects to unified baseline...", "info");
        try {
            const res = await api("projects/align", "POST", {
                project_paths: projectsData.projects.map(p => typeof p === "string" ? `/Users/devanshpc/Developer/${p}` : p.path),
                target_versions: projectsData.baseline?.versions || {},
                target_wrapper: projectsData.baseline?.wrapper?.version,
                align_wrapper: true,
                align_properties: true
            });

            if (res.success) {
                showToast(`Successfully aligned all ${count} projects!`);
                await loadProjects(true);
                await refreshAll();
            } else {
                showToast("Alignment failed: " + (res.error || "Unknown"), "error");
            }
        } catch (err) {
            showToast("Error: " + err.message, "error");
        }
    }

    async function alignSingleKey(key, targetVersion) {
        if (!projectsData || !projectsData.projects) return;
        showToast(`Aligning ${key} to ${targetVersion}...`, "info");
        try {
            const res = await api("projects/align", "POST", {
                project_paths: projectsData.projects.map(p => typeof p === "string" ? `/Users/devanshpc/Developer/${p}` : p.path),
                target_versions: { [key]: targetVersion },
                align_wrapper: false,
                align_properties: false
            });

            if (res.success) {
                showToast(`Aligned ${key} = ${targetVersion}`);
                await loadProjects(true);
                renderTab();
            }
        } catch (err) {
            showToast("Failed: " + err.message, "error");
        }
    }

    async function toggleEnforcer() {
        showToast("Toggling global enforcer...", "info");
        try {
            const res = await api("enforcer/toggle", "POST");
            if (projectsData) {
                projectsData.enforcer_enabled = res.enabled;
            }
            showToast(res.enabled ? "Global init.d Enforcer ENABLED" : "Global init.d Enforcer DISABLED");
            renderTab();
        } catch (err) {
            showToast("Failed: " + err.message, "error");
        }
    }

    async function addProjectPath() {
        const input = $("newProjectPathInput");
        const val = (input?.value || "").trim();
        if (!val) {
            showToast("Please enter a valid project directory path", "error");
            return;
        }

        showToast("Registering project...", "info");
        try {
            const res = await api("projects/register", "POST", { path: val });
            if (res.success) {
                showToast(`Project registered: ${res.project?.name || val}`);
                if (input) input.value = "";
                await loadProjects(true);
            } else {
                showToast("Registration failed: " + (res.error || "Unknown error"), "error");
            }
        } catch (err) {
            showToast("Registration failed: " + err.message, "error");
        }
    }

    async function removeProject(path, name) {
        if (!confirm(`Unregister project "${name || path}" from Gradle Cache Manager?\n\n(This will not delete any files on disk)`)) {
            return;
        }

        showToast("Removing project...", "info");
        try {
            const res = await api("projects/unregister", "POST", { path: path });
            if (res.success) {
                showToast(`Unregistered ${name || path}`);
                await loadProjects(true);
            } else {
                showToast("Failed: " + (res.error || "Unknown"), "error");
            }
        } catch (err) {
            showToast("Failed: " + err.message, "error");
        }
    }

    async function deduplicateAllLibs() {
        if (!confirm("Clean all older/duplicate versions from cache?\n\nThe latest version of every library will be kept intact.")) {
            return;
        }
        showToast("Deduplicating libraries...", "info");
        try {
            const res = await api("libraries/deduplicate", "POST");
            if (res.success) {
                showToast(`Freed ${res.freed_fmt}, removed ${res.deleted} older version(s)`);
                await refreshAll();
            } else {
                showToast(res.message || "Failed", "error");
            }
        } catch (err) {
            showToast("Deduplication error: " + err.message, "error");
        }
    }

    async function deduplicateGroup(group) {
        if (!confirm(`Delete older versions in "${group}"? The latest version will be preserved.`)) {
            return;
        }
        showToast(`Deduplicating ${group}...`, "info");
        try {
            const res = await api("libraries/deduplicate", "POST", { scope: group });
            if (res.success) {
                showToast(`Freed ${res.freed_fmt} in ${group}`);
                await refreshAll();
            }
        } catch (err) {
            showToast("Failed: " + err.message, "error");
        }
    }

    // ================================================================
    // DAEMON CONTROL
    // ================================================================

    async function stopDaemons() {
        showToast("Stopping daemons...", "info");
        try {
            const res = await api("stop-daemons", "POST");
            showToast(res.message || "Done");
        } catch (err) {
            showToast("Failed: " + err.message, "error");
        }
    }

    // --- Boot -------------------------------------------------------

    function init() {
        ["modalBackdrop", "snippetBackdrop"].forEach(id => {
            $(id)?.addEventListener("click", (e) => {
                if (e.target === $(id)) {
                    closeModal();
                    closeSnippet();
                }
            });
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closeModal();
                closeSnippet();
            }
        });

        // Preload flags and projects in background
        loadFlags(true);
        loadProjects(true);

        refreshAll();
    }

    // --- Public API -------------------------------------------------

    return {
        init,
        switchTab,
        refreshAll,
        toggleAll,
        toggleGroup,
        filterLibs,
        // Delete
        requestDelete,
        deleteSelected,
        deleteSuiteVersion,
        closeModal,
        confirmDelete,
        // Snippets
        showSuiteSnippet,
        showWrapperSnippet,
        showLibSnippet,
        switchFormat,
        copySnippet,
        closeSnippet,
        // Projects & Alignment
        loadProjects,
        addProjectPath,
        removeProject,
        getAlignFilter,
        setAlignFilter,
        getLibViewMode,
        setLibViewMode,
        alignAllProjects,
        alignSingleKey,
        toggleEnforcer,
        deduplicateAllLibs,
        deduplicateGroup,
        // Properties Builder
        loadFlags,
        filterFlags,
        filterCategory,
        toggleFlag,
        setFlagValue,
        selectRecommended,
        clearAllFlags,
        copyProperties,
        downloadProperties,
        openAddFlagModal,
        saveCustomFlag,
        removeCustomFlag,
        openSyncModal,
        syncFromUrl,
        importFromJson,
        // Daemons
        stopDaemons,
    };
})();

// Start the app when the DOM is ready.
document.addEventListener("DOMContentLoaded", App.init);
