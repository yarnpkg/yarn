.PHONY: build test watch lint typecheck test-only test-ci

build:
	./node_modules/.bin/gulp build

watch:
	./node_modules/.bin/gulp watch

typecheck:
	./node_modules/.bin/flow check

test-only:
	./node_modules/.bin/ava --verbose test/

lint:
	./node_modules/.bin/eslint bin src tests

test: lint typecheck test-only

test-ci: build test
