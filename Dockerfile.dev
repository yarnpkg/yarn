# Dockerfile for building Yarn.
# docker build -t yarnpkg/dev -f Dockerfile.dev .

FROM yarnpkg/node-yarn:latest
MAINTAINER Daniel Lo Nigro <yarn@dan.cx>

# Debian packages
RUN apt-get -y update && \
  apt-get install -y --no-install-recommends \
    fakeroot \
    lintian \
    rpm \
    ruby \
    ruby-dev \
    unzip \
  && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

# Ruby packages
RUN gem install fpm

### Custom apps
# ghr (just needed for releases, could probably be optional)
ADD https://github.com/tcnksm/ghr/releases/download/v0.5.0/ghr_v0.5.0_linux_amd64.zip /tmp/ghr.zip
RUN unzip /tmp/ghr.zip -d /usr/local/bin/ && rm /tmp/ghr.zip
