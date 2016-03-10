.PHONY: build test watch lint typecheck test-only test-ci test-cov

build:
	./node_modules/.bin/gulp build

watch:
	./node_modules/.bin/gulp watch

test-only:
	./node_modules/.bin/nyc --check-coverage --lines 77 --branches 67 --functions 77 ./node_modules/.bin/ava --verbose test/
	./node_modules/.bin/nyc report --reporter=lcov

lint:
	./node_modules/.bin/kcheck

test: lint test-only

test-ci: build test
