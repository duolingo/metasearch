.DEFAULT_GOAL := all
MAKEFLAGS += --silent
SHELL = /usr/bin/env bash

# Build and serve. Intended use case: local development
.PHONY: all
all: build serve

# Compile assets. Intended use case: Docker build step
.PHONY: build
build: _install ui _ts
	cp src/ui/ui.js* dist/

# Install NPM dependencies
.PHONY: _install
_install:
	[[ "$$(node --version 2>&1)" = "v$$(cat .node-version)" ]] \
		|| { echo "Please install Node.js v$$(cat .node-version)"; exit 1; }
	echo 'Installing NPM dependencies...'
	npm ci

# Get a Google OAuth refresh token
.PHONY: oauth
oauth: _ts
	node src/oauth.js

# Serve pre-built JS. Intended use case: Docker entry point
.PHONY: serve
serve:
	node src/index.js

# Compile TypeScript
.PHONY: _ts
_ts: _install
	echo 'Compiling TypeScript...'
	node_modules/.bin/tsc

# Compile CSS. Intended use case: rapid local development of UI code
.PHONY: ui
ui:
	echo 'Compiling Sass...'
	node_modules/.bin/sass -s compressed src/ui/styles.scss dist/styles.css
