# Dockerfile for building Yarn.
# docker build -t yarnpkg/dev -f Dockerfile.dev .

FROM node:10

# Debian packages
RUN apt-get -y update && \
  apt-get install -y --no-install-recommends \
    fakeroot \
    lintian \
    rpm \
    ruby \
    ruby-dev \
  && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

# Ruby packages
RUN gem install fpm
