convert:
	@rm -rf output
	@mkdir -p output
	@cat convertedPackages.txt \
		| grep -v '^#' \
		| grep -v '^$$' \
		| xargs -P8 -L1 ./bin/build-package
