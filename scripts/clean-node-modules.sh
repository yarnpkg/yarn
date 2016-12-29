#!/bin/sh

# random browser builds that aren't used
rm -rf node_modules/core-js/client

# remove typescript files
rm -rf node_modules/rx/ts

# naughty modules that have their test folders
rm -rf node_modules/*/test
