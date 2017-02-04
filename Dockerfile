# Dockerfile for building Yarn.

#FROM debian:stretch-slim
FROM ubuntu:16.04
MAINTAINER Daniel Lo Nigro <daniel@dan.cx>

# Add Yarn package repo - We require Yarn to build Yarn itself :D
ADD https://dl.yarnpkg.com/debian/pubkey.gpg /tmp/yarn-pubkey.gpg
RUN apt-key add /tmp/yarn-pubkey.gpg && rm /tmp/yarn-pubkey.gpg
RUN echo "deb http://dl.yarnpkg.com/debian/ stable main" > /etc/apt/sources.list.d/yarn.list

# Debian packages
ENV DEBIAN_FRONTEND noninteractive
RUN apt-get -y update && \
  apt-get install -y --no-install-recommends \
    fakeroot \
    gcc \
    git \
    lintian \
    make \
    nodejs \
    nodejs-legacy \
    npm \
    rpm \
    ruby \
    ruby-dev \
    unzip \
    yarn \
  && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

# Ruby packages
RUN gem install fpm

### Custom apps
# ghr (just needed for releases, could probably be optional)
ADD https://github.com/tcnksm/ghr/releases/download/v0.5.0/ghr_v0.5.0_linux_amd64.zip /tmp/ghr.zip
RUN unzip /tmp/ghr.zip -d /usr/local/bin/ && rm /tmp/ghr.zip
