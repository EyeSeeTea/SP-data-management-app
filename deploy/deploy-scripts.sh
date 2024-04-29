#!/bin/bash
# shellcheck disable=SC2029
set -e -u -o pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

debug() {
    echo "$@" >&2
}

get_current_branch() {
    git rev-parse --abbrev-ref HEAD
}

deploy_scripts() {
    local host=$1

    local current_branch
    current_branch=$(get_current_branch)
    debug "Deploy branch: $current_branch -> $host"

    rsync -v "$script_dir/deploy-remote-scripts.sh" "$host:"
    ssh "$host" "sudo bash deploy-remote-scripts.sh $current_branch"
}

deploy_scripts "$@"
