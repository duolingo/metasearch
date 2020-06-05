.DEFAULT_GOAL := serve
MAKEFLAGS += --silent
SHELL = /usr/bin/env bash

.PHONY: build
build:
	npm ci
	node_modules/.bin/tsc

.PHONY: serve
serve:
	node src/index.js
