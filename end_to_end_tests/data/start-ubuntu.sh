#!/bin/bash
# Starts an Ubuntu Docker container and runs the Yarn end-to-end test on it
set -ex

if [ -z "$1" ]; then
  echo 'Ubuntu distribution was not specified'
  exit 1
fi;

data_path=$(dirname $(readlink -f "$0"))
docker run --rm -v $data_path:/data -w=/data -e APT_PROXY=$APT_PROXY -e DEBIAN_FRONTEND=noninteractive $1 /data/run-ubuntu.sh
