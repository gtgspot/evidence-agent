PYTHON ?= python3
DIST_DIR := dist
BIN := $(DIST_DIR)/evidence-agent

.PHONY: compile clean

compile:
	mkdir -p $(DIST_DIR)
	$(PYTHON) -m zipapp src -m "evidence_agent.__main__:main" -p "/usr/bin/env python3" -o $(BIN)
	chmod +x $(BIN)

clean:
	rm -rf $(DIST_DIR) build

