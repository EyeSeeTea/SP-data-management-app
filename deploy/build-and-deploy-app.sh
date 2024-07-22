#!/bin/bash
set -e -u -o pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
zipfile=data-management-app.zip

debug() {
    echo "$@" >&2
}

build_app() {
    test "${SKIP_BUILD:-}" && return 0
    debug "Build App"
    yarn build-webapp
}

deploy_app() {
    local url=$1 auth=$2
    test "${SKIP_DEPLOY_APP:-}" && return 0

    debug "Post App: $zipfile -> $url"
    curl -X POST -u "$auth" -v -F file=@"$zipfile" "$url/api/apps"
}

build_and_deploy() {
    local url=$1 auth=$2 host=${3:-}

    build_app
    deploy_app "$url" "$auth"
    if test "$host"; then
        bash "$script_dir/deploy-scripts.sh" "$host"
    fi

    echo "Done"
}

build_and_deploy "$@"
