.DEFAULT_GOAL := all
MAKEFLAGS += --silent
SHELL = /usr/bin/env bash

.PHONY: all
all: build serve

.PHONY: build
build:
	[[ "$$(node --version 2>&1)" = "v$$(cat .node-version)" ]] \
		|| { echo "Please install Node.js v$$(cat .node-version)"; exit 1; }
	npm ci
	node_modules/.bin/tsc

.PHONY: serve
serve:
	node src/index.js
