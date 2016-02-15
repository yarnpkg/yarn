.PHONY: build test watch lint typecheck test-only test-ci test-cov

build:
	./node_modules/.bin/gulp build

watch:
	./node_modules/.bin/gulp watch

test-only:
	./node_modules/.bin/ava --verbose test/

test-cov:
	nyc make test-only
	nyc report --reporter=lcov
	open coverage/lcov-report/index.html

lint:
	./node_modules/.bin/kcheck

test: lint test-only

test-ci: build test
