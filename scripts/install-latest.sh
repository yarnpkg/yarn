#!/bin/bash
set -e

reset="\e[0m"
red="\e[0;31m"

printf "${red}This script has moved to https://yarnpkg.com/install.sh, please update your URL!$reset\n"
curl --compressed -o- -L https://yarnpkg.com/install.sh | bash -s -- "$@"
