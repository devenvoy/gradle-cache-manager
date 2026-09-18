.DEFAULT_GOAL := help
PYTHON        := python3
PORT          := 8484
PID_FILE      := .server.pid
SCRIPT        := gradle_cache_manager.py

.PHONY: help run run-no-browser start stop restart status clean test-scan test-flags

help: ## Show this help menu
	@echo ""
	@echo "Gradle Cache Manager — Control Commands"
	@echo "========================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo ""

run: ## Run server in foreground and auto-open browser
	@if lsof -ti:$(PORT) >/dev/null 2>&1; then \
		echo "Port $(PORT) is currently in use. Stopping existing instance..."; \
		lsof -ti:$(PORT) | xargs kill -9 2>/dev/null; \
		rm -f $(PID_FILE); \
		sleep 0.5; \
	fi
	$(PYTHON) $(SCRIPT) --port $(PORT)

run-no-browser: ## Run server in foreground without opening browser
	@if lsof -ti:$(PORT) >/dev/null 2>&1; then \
		echo "Port $(PORT) is currently in use. Stopping existing instance..."; \
		lsof -ti:$(PORT) | xargs kill -9 2>/dev/null; \
		rm -f $(PID_FILE); \
		sleep 0.5; \
	fi
	$(PYTHON) $(SCRIPT) --port $(PORT) --no-browser

start: ## Start server in background
	@if lsof -ti:$(PORT) >/dev/null 2>&1; then \
		echo "Server is already running on http://localhost:$(PORT)"; \
	else \
		nohup $(PYTHON) $(SCRIPT) --port $(PORT) --no-browser > server.log 2>&1 & \
		echo $$! > $(PID_FILE); \
		sleep 1; \
		if lsof -ti:$(PORT) >/dev/null 2>&1; then \
			echo "Started server on http://localhost:$(PORT) (PID: $$(cat $(PID_FILE)))"; \
		else \
			echo "Failed to start server. Check server.log"; \
		fi; \
	fi

stop: ## Stop the background server
	@if lsof -ti:$(PORT) >/dev/null 2>&1; then \
		lsof -ti:$(PORT) | xargs kill -9 2>/dev/null; \
		rm -f $(PID_FILE); \
		echo "Stopped server on port $(PORT)"; \
	else \
		echo "No server running on port $(PORT)"; \
	fi

restart: stop start ## Restart the background server

status: ## Check if server is running and display port status
	@if lsof -ti:$(PORT) >/dev/null 2>&1; then \
		echo "Server is RUNNING on http://localhost:$(PORT) (PID: $$(lsof -ti:$(PORT) | tr '\n' ' '))"; \
	else \
		echo "Server is STOPPED"; \
	fi

clean: ## Clean Python cache files and temp logs
	rm -rf __pycache__ static/__pycache__ *.pyc server.log $(PID_FILE)
	@echo "Cleaned temporary files"

test-scan: ## Test /api/scan endpoint
	curl -s http://localhost:$(PORT)/api/scan | python3 -m json.tool | head -n 30

test-flags: ## Test /api/flags endpoint
	curl -s http://localhost:$(PORT)/api/flags | python3 -m json.tool | head -n 30

align-projects: ## 1-Click align all local projects to machine baseline
	@curl -s -X POST http://localhost:$(PORT)/api/projects/align \
		-H "Content-Type: application/json" \
		-d '{"project_paths":["/Users/devanshpc/Developer/Linkora","/Users/devanshpc/Developer/My-Ration","/Users/devanshpc/Developer/NutriTrack","/Users/devanshpc/Developer/Zevva","/Users/devanshpc/Developer/finkeep"]}' | python3 -m json.tool

prune-cache: ## Clean duplicate older library versions from cache
	@curl -s -X POST http://localhost:$(PORT)/api/libraries/deduplicate \
		-H "Content-Type: application/json" \
		-d '{}' | python3 -m json.tool

build-plugin: ## Build the Android Studio plugin .zip distribution
	@echo "Building Android Studio Plugin (Gradle Version Guard)..."
	cd plugins/android-studio-plugin && ./gradlew buildPlugin
	@echo "Plugin build complete! Distribution zip is in plugins/android-studio-plugin/build/distributions/"

