#!/bin/bash
set -e -u -o pipefail

cd "$(dirname "$0")"
script_dir=$(pwd)
source "./lib.sh"
source "./tasks.sh"

image_test="docker.eyeseetea.com/samaritans/dhis2-data:40.4.0-sp-ip-test"

start_from_pro() {
    local url=$1
    local image_test_running

    image_test_running=$(d2-docker list | grep RUN | awk '{print $1}' | grep -m1 ip-test) || true
    if test "$image_test_running"; then
        d2-docker commit "$image_test_running"
        d2-docker copy "$image_test_running" "backup/sp-ip-test-$(timestamp)"
        d2-docker stop "$image_test_running"
    fi

    d2-docker pull "$image_pro"
    d2-docker copy "$image_pro" "$image_test"
    sudo image=$image_test /usr/local/bin/start-dhis2-test

    wait_for_dhis2_server "$url"
}

post_clone() {
    local url=$1

    #set_email_password "$url"
    change_server_name "$url" "SP Platform - Test"
    set_logos "$url" "$script_dir/test-icons"
}

main() {
    local url
    url=$(get_url 80)

    start_from_pro "$url"
    post_clone "$url"
}

main "$@"
