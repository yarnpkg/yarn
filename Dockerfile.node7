# Dockerfile for using Yarn along with Node.js 7.x
# docker build -t yarnpkg/node-yarn:latest -f Dockerfile.node7 .

FROM node:7
MAINTAINER Daniel Lo Nigro <yarn@dan.cx>

ADD https://dl.yarnpkg.com/debian/pubkey.gpg /tmp/yarn-pubkey.gpg
RUN apt-key add /tmp/yarn-pubkey.gpg && rm /tmp/yarn-pubkey.gpg
RUN echo "deb http://dl.yarnpkg.com/debian/ stable main" > /etc/apt/sources.list.d/yarn.list

RUN apt-get -y update && \
  apt-get install -y --no-install-recommends yarn && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*
