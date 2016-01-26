.PHONY: build test watch lint typecheck test-only test-ci test-cov

build:
	./node_modules/.bin/gulp build

watch:
	./node_modules/.bin/gulp watch

typecheck:
	./node_modules/.bin/flow check

test-only:
	./node_modules/.bin/ava --verbose test/

test-cov:
	nyc --reporter=lcov --reporter=text-lcov make test-only
	nyc report --reporter=lcov
	open coverage/index.html

lint:
	./node_modules/.bin/eslint bin src tests

test: lint typecheck test-only

test-ci: build test
