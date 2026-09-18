/**
 * icons.js — SVG icon library (Lucide-style, 24×24 stroke icons).
 *
 * Each function returns an SVG string.  Pass an optional `size` to override
 * the default 24px.  All icons are stroke-based, currentColor-driven.
 */

const Icons = (() => {
    const s = (paths, size = 24) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
        `viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
        `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

    return {
        /** Gradle elephant / package box */
        package: (sz) => s(
            `<path d="M16.5 9.4 7.55 4.24"/>` +
            `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>` +
            `<polyline points="3.29 7 12 12 20.71 7"/>` +
            `<line x1="12" y1="22" x2="12" y2="12"/>`, sz),

        /** Library / books */
        library: (sz) => s(
            `<path d="m16 6 4 14"/>` +
            `<path d="M12 6v14"/>` +
            `<path d="M8 8v12"/>` +
            `<path d="M4 4v16"/>`, sz),

        /** Database / storage */
        database: (sz) => s(
            `<ellipse cx="12" cy="5" rx="9" ry="3"/>` +
            `<path d="M3 5V19A9 3 0 0 0 21 19V5"/>` +
            `<path d="M3 12A9 3 0 0 0 21 12"/>`, sz),

        /** Activity / daemon heartbeat */
        activity: (sz) => s(
            `<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>`, sz),

        /** Wrench / settings */
        wrench: (sz) => s(
            `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`, sz),

        /** Trash can */
        trash: (sz) => s(
            `<path d="M3 6h18"/>` +
            `<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>` +
            `<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>` +
            `<line x1="10" y1="11" x2="10" y2="17"/>` +
            `<line x1="14" y1="11" x2="14" y2="17"/>`, sz),

        /** Search magnifier */
        search: (sz) => s(
            `<circle cx="11" cy="11" r="8"/>` +
            `<path d="m21 21-4.3-4.3"/>`, sz),

        /** Refresh / rotate */
        refresh: (sz) => s(
            `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>` +
            `<path d="M21 3v5h-5"/>` +
            `<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>` +
            `<path d="M8 16H3v5"/>`, sz),

        /** Chevron right */
        chevronRight: (sz) => s(`<path d="m9 18 6-6-6-6"/>`, sz),

        /** Square stop */
        square: (sz) => s(`<rect width="18" height="18" x="3" y="3" rx="2"/>`, sz),

        /** X / close */
        x: (sz) => s(`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`, sz),

        /** Check / success */
        check: (sz) => s(`<path d="M20 6 9 17l-5-5"/>`, sz),

        /** Alert triangle */
        alertTriangle: (sz) => s(
            `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>` +
            `<path d="M12 9v4"/><path d="M12 17h.01"/>`, sz),

        /** Info circle */
        info: (sz) => s(
            `<circle cx="12" cy="12" r="10"/>` +
            `<path d="M12 16v-4"/><path d="M12 8h.01"/>`, sz),

        /** Folder */
        folder: (sz) => s(
            `<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>`, sz),

        /** Hard drive */
        hardDrive: (sz) => s(
            `<line x1="22" y1="12" x2="2" y2="12"/>` +
            `<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>` +
            `<line x1="6" y1="16" x2="6.01" y2="16"/>` +
            `<line x1="10" y1="16" x2="10.01" y2="16"/>`, sz),

        /** Arrow down-left (sub-item indicator) */
        cornerDownRight: (sz) => s(
            `<polyline points="15 10 20 15 15 20"/>` +
            `<path d="M4 4v7a4 4 0 0 0 4 4h12"/>`, sz),

        /** Copy / clipboard */
        copy: (sz) => s(
            `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>` +
            `<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`, sz),

        /** Code brackets */
        code: (sz) => s(
            `<polyline points="16 18 22 12 16 6"/>` +
            `<polyline points="8 6 2 12 8 18"/>`, sz),

        /** File text */
        fileText: (sz) => s(
            `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>` +
            `<path d="M14 2v4a2 2 0 0 0 2 2h4"/>` +
            `<line x1="10" x2="8" y1="9" y2="9"/>` +
            `<line x1="16" x2="8" y1="13" y2="13"/>` +
            `<line x1="16" x2="8" y1="17" y2="17"/>`, sz),

        /** Download */
        download: (sz) => s(
            `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>` +
            `<polyline points="7 10 12 15 17 10"/>` +
            `<line x1="12" x2="12" y1="15" y2="3"/>`, sz),

        /** Sliders / settings */
        sliders: (sz) => s(
            `<line x1="4" x2="4" y1="21" y2="14"/>` +
            `<line x1="4" x2="4" y1="10" y2="3"/>` +
            `<line x1="12" x2="12" y1="21" y2="12"/>` +
            `<line x1="12" x2="12" y1="8" y2="3"/>` +
            `<line x1="20" x2="20" y1="21" y2="16"/>` +
            `<line x1="20" x2="20" y1="12" y2="3"/>` +
            `<line x1="2" x2="6" y1="14" y2="14"/>` +
            `<line x1="10" x2="14" y1="8" y2="8"/>` +
            `<line x1="18" x2="22" y1="16" y2="16"/>`, sz),

        /** External link */
        externalLink: (sz) => s(
            `<path d="M15 3h6v6"/>` +
            `<path d="M10 14 21 3"/>` +
            `<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>`, sz),

        /** Plus */
        plus: (sz) => s(
            `<path d="M5 12h14"/>` +
            `<path d="M12 5v14"/>`, sz),

        /** Star (recommended) */
        star: (sz) => s(
            `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`, sz),

        /** Git branch / version */
        gitBranch: (sz) => s(
            `<line x1="6" x2="6" y1="3" y2="15"/>` +
            `<circle cx="18" cy="6" r="3"/>` +
            `<circle cx="6" cy="18" r="3"/>` +
            `<path d="M18 9a9 9 0 0 1-9 9"/>`, sz),

        /** Layers / ecosystems */
        layers: (sz) => s(
            `<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>` +
            `<path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>` +
            `<path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>`, sz),

        /** Shield / enforcer */
        shield: (sz) => s(
            `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>`, sz),

        /** Sparkles / direct library */
        sparkles: (sz) => s(
            `<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>` +
            `<path d="M5 3v4"/>` +
            `<path d="M19 17v4"/>` +
            `<path d="M3 5h4"/>` +
            `<path d="M17 19h4"/>`, sz),

        /** Check check / deduplicate */
        checkCheck: (sz) => s(
            `<path d="M18 6 7 17l-5-5"/>` +
            `<path d="m22 10-7.5 7.5L13 16"/>`, sz),

        /** Box / package */
        box: (sz) => s(
            `<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>` +
            `<path d="m3.3 7 8.7 5 8.7-5"/>` +
            `<path d="M12 22V12"/>`, sz),
    };
})();
