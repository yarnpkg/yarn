.PHONY: build test watch lint typecheck test-only test-ci test-cov build-dist

build:
	./node_modules/.bin/gulp build

watch:
	./node_modules/.bin/gulp watch

test-only:
	./node_modules/.bin/jest --coverage --verbose -i

test-install-only:
	./node_modules/.bin/jest --verbose -i __tests__/commands/install.js

lint:
	./node_modules/.bin/eslint .
	./node_modules/.bin/flow check

build-dist:
	npm pack
	rm -rf dist
	mkdir dist
	mv kpm-*.tgz dist/pack.tgz
	cd dist; \
		tar -xzf pack.tgz --strip 1; \
		rm -rf pack.tgz; \
		npm install --production; \
		rm -rf node_modules/*/test node_modules/*/dist
	tar -cvzf dist/kpm-v`node dist/bin/kpm --version`.tar.gz dist/*; \
		shasum -a 256 dist/kpm-*.tar.gz

test: lint test-only

test-ci: build test

release-branch:
	./scripts/release-branch.sh
