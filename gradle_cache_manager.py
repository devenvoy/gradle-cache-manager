#!/usr/bin/env python3
"""
Gradle Cache Manager — Entry point & HTTP server.

A lightweight web-based GUI for viewing, managing, and deleting
Gradle distributions, cached libraries, build caches, daemons,
and Kotlin/Native artifacts.

Usage:
    python3 gradle_cache_manager.py            # default port 8484
    python3 gradle_cache_manager.py --port 9090 # custom port

Project layout:
    gradle_cache_manager.py   ← this file (server + routing)
    scanner.py                ← filesystem scanning logic
    deleter.py                ← safe deletion operations
    templates/index.html      ← HTML shell
    static/style.css          ← styles (GitHub Dark theme)
    static/icons.js           ← SVG icon library
    static/components.js      ← UI rendering functions
    static/app.js             ← application controller
"""

import argparse
import json
import mimetypes
import threading
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

from scanner import scan_all
from deleter import delete_paths, stop_daemons, DeleteError
from flags_registry import (
    get_all_flags, get_categories, add_custom_flag,
    remove_custom_flag, import_custom_flags, fetch_and_import_remote_flags
)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

ROOT_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = ROOT_DIR / "templates"
STATIC_DIR = ROOT_DIR / "static"

# ---------------------------------------------------------------------------
# Request Handler
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    """Routes requests to static files, HTML templates, or JSON API."""

    # Silence per-request log lines; override to enable.
    def log_message(self, fmt, *args):
        pass

    # ----- Response helpers --------------------------------------------------

    def _send(self, body: bytes, content_type: str, status: int = 200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json(self, data: dict, status: int = 200):
        self._send(json.dumps(data).encode(), "application/json", status)

    def _html(self, path: Path):
        self._send(path.read_bytes(), "text/html; charset=utf-8")

    def _static(self, rel_path: str):
        file_path = STATIC_DIR / rel_path
        if not file_path.is_file():
            self.send_error(404)
            return
        mime, _ = mimetypes.guess_type(str(file_path))
        self._send(file_path.read_bytes(), mime or "application/octet-stream")

    # ----- Routing -----------------------------------------------------------

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/":
            self._html(TEMPLATES_DIR / "index.html")

        elif path.startswith("/static/"):
            self._static(path[len("/static/"):])

        elif path == "/api/scan":
            self._json(scan_all())

        elif path == "/api/flags":
            self._json({
                "flags": get_all_flags(),
                "categories": get_categories(),
            })

        else:
            self.send_error(404)

    def do_POST(self):
        path = urlparse(self.path).path
        body = self._read_body()

        if path == "/api/delete":
            paths = body.get("paths", [])
            try:
                result = delete_paths(paths)
                self._json(result)
            except DeleteError as exc:
                self._json({"success": False, "error": str(exc)}, 400)

        elif path == "/api/stop-daemons":
            message = stop_daemons()
            self._json({"message": message})

        elif path == "/api/flags/add":
            flag = body.get("flag", {})
            if not flag.get("key"):
                self._json({"success": False, "error": "Flag key is required"}, 400)
                return
            add_custom_flag(flag)
            self._json({"success": True})

        elif path == "/api/flags/remove":
            key = body.get("key", "")
            if not key:
                self._json({"success": False, "error": "Flag key is required"}, 400)
                return
            remove_custom_flag(key)
            self._json({"success": True})

        elif path == "/api/flags/import":
            flags_list = body.get("flags", [])
            if not isinstance(flags_list, list):
                self._json({"success": False, "error": "Expected a list of flags"}, 400)
                return
            count = import_custom_flags(flags_list)
            self._json({"success": True, "count": count})

        elif path == "/api/flags/sync-url":
            url = body.get("url", "")
            if not url or not url.startswith(("http://", "https://")):
                self._json({"success": False, "error": "Valid http/https URL is required"}, 400)
                return
            try:
                count = fetch_and_import_remote_flags(url)
                self._json({"success": True, "count": count})
            except Exception as exc:
                self._json({"success": False, "error": str(exc)}, 500)

        else:
            self.send_error(404)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))


# ---------------------------------------------------------------------------
# Server bootstrap
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Gradle Cache Manager")
    parser.add_argument("--port", type=int, default=8484, help="HTTP port (default: 8484)")
    parser.add_argument("--no-browser", action="store_true", help="Don't open the browser automatically")
    args = parser.parse_args()

    HTTPServer.allow_reuse_address = True
    try:
        server = HTTPServer(("", args.port), Handler)
    except OSError as exc:
        if exc.errno == 48:
            print(f"\n  ⚠️  Port {args.port} is already in use.")
            print(f"  👉 If running in the background, stop it with:  make stop")
            print(f"  👉 Or view the running instance at:          http://localhost:{args.port}\n")
            return
        raise exc

    url = f"http://localhost:{args.port}"

    print()
    print("  Gradle Cache Manager")
    print(f"  Running at:   {url}")
    print(f"  Gradle Home:  ~/.gradle")
    print()
    print("  Press Ctrl+C to stop")
    print()

    if not args.no_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Shutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
