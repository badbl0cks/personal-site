#!/bin/bash

#######################
# VARIABLES           #
#######################
ROOT_DIR=$(dirname $(dirname $(dirname $(realpath $0))))
GIT_REF=${GIT_REF:-main}

### NO EDITS BELOW THIS LINE ###
cd ${ROOT_DIR}
source .env
git checkout ${GIT_REF}
GIT_SHA=$(git rev-parse --short HEAD)

if [[ "${GIT_REF}" =~ ^refs/tags/v([0-9]+\.[0-9]+\.[0-9]+)(-.*)?$ ]]; then
  VERSION="${BASH_REMATCH[1]}"
  if [[ -n "${BASH_REMATCH[2]}" ]]; then
    VERSION="${VERSION}${BASH_REMATCH[2]}"
  fi
  echo "Using git tag version: ${VERSION}"
else
  VERSION=$(node -p "require('./package.json').version || '0.0.0'")
  GIT_SHA_SHORT="${GIT_SHA:0:7}"
  VERSION="${VERSION}-${GIT_SHA_SHORT}"
  echo "Using package.json + SHA version: ${VERSION}"
fi

docker build -t ${IMAGE_NAME}:latest -t ${IMAGE_NAME}:v${VERSION} --build-arg VERSION=${VERSION} .
docker save -o ${IMAGE_FILENAME} ${IMAGE_NAME}:latest
