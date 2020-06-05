.DEFAULT_GOAL := all
MAKEFLAGS += --silent
SHELL = /usr/bin/env bash

# Build and serve (intended use case: local development)
.PHONY: all
all: build serve

# Install NPM dependencies and compile TypeScript
.PHONY: build
build:
	[[ "$$(node --version 2>&1)" = "v$$(cat .node-version)" ]] \
		|| { echo "Please install Node.js v$$(cat .node-version)"; exit 1; }
	npm ci
	node_modules/.bin/tsc

# Serve pre-built JS (intended use case: Docker entry point)
.PHONY: serve
serve:
	node src/index.js
