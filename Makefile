.DEFAULT_GOAL := all
MAKEFLAGS += --silent
SHELL = /usr/bin/env bash

# Build and serve. Intended use case: local development
.PHONY: all
all: build
	# This command is duplicated in the Dockerfile as its ENTRYPOINT. Ideally we'd
	# factor it out into a separate Make target that we could use as ENTRYPOINT,
	# but that causes server shutdown (e.g. via `docker stop`) to fail:
	#
	#     make: *** wait: No child processes.  Stop.
	#     make: *** [Makefile:10: serve] Error 2
	#
	# Possibly related to this:
	# https://medium.com/@becintec/building-graceful-node-applications-in-docker-4d2cd4d5d392
	NODE_ENV=production node src/index.js

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

# Install NPM dependencies and compile TypeScript
.PHONY: _ts
_ts:
	echo 'Installing NPM dependencies...'
	npm ci
	echo 'Compiling TypeScript...'
	NODE_OPTIONS=--max_old_space_size=4096 node_modules/.bin/tsc
