.DEFAULT_GOAL := all
MAKEFLAGS += --silent
SHELL = /usr/bin/env bash

# Build and serve. Intended use case: local development
.PHONY: all
all: build serve

# Compile assets. Intended use case: Docker build step
.PHONY: build
build: _ts
	node_modules/.bin/uglifyjs -c -m -o dist/ui.js src/ui/ui.js
	echo 'Compiling Sass...'
	node_modules/.bin/sass --no-source-map -s compressed src/ui/styles.scss dist/styles.css

# Get a Google OAuth refresh token
.PHONY: oauth
oauth: _ts
	node src/oauth.js

# Serve pre-built JS. Intended use case: Docker entry point
.PHONY: serve
serve:
	NODE_ENV=production node src/index.js

# Install NPM dependencies and compile TypeScript
.PHONY: _ts
_ts:
	[[ "$$(node --version 2>&1)" = "v$$(cat .node-version)" ]] \
		|| { echo "Please install Node.js v$$(cat .node-version)"; exit 1; }
	echo 'Installing NPM dependencies...'
	npm ci
	echo 'Compiling TypeScript...'
	node_modules/.bin/tsc
