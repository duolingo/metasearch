.DEFAULT_GOAL := all
MAKEFLAGS += --silent
SHELL = /usr/bin/env bash

# Build and serve (intended use case: local development)
.PHONY: all
all: build serve

# Install NPM dependencies and compile assets
.PHONY: build
build:
	[[ "$$(node --version 2>&1)" = "v$$(cat .node-version)" ]] \
		|| { echo "Please install Node.js v$$(cat .node-version)"; exit 1; }
	echo 'Installing NPM dependencies...'
	npm ci
	echo 'Compiling EJS...'
	node_modules/.bin/ejs -o dist/index.html \
		-i "%7B%22v%22%3A%22$$(git rev-parse HEAD)%22%7D" src/ui/index.ejs
	echo 'Compiling Sass...'
	node_modules/.bin/sass -s compressed src/ui/styles.scss dist/styles.css
	echo 'Compiling TypeScript...'
	node_modules/.bin/tsc
	cp src/ui/ui.js* dist/

# Serve pre-built JS (intended use case: Docker entry point)
.PHONY: serve
serve:
	node src/index.js
