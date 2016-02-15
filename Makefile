.PHONY: build test watch lint typecheck test-only test-ci test-cov

build:
	./node_modules/.bin/gulp build

watch:
	./node_modules/.bin/gulp watch

test-only:
	nyc --check-coverage --lines 100 --branches 100 --functions 100 ./node_modules/.bin/ava --verbose test/
	nyc report --reporter=lcov

lint:
	./node_modules/.bin/kcheck

test: lint test-only

test-ci: build test
