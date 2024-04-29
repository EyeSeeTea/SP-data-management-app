#!/bin/bash
set -e -u -o pipefail

cd "$(dirname "$0")"
script_dir=$(pwd)
source "./lib.sh"
source "./tasks.sh"

post_clone() {
    local url=$1
    set_email_password "$url"
    change_server_name "$url" "SP Platform - Test"
    set_logos "$url" "$script_dir/test-icons"
}

start_from_pro() {
    d2-docker pull "$image_pro"
    d2-docker commit "$image_test"
    d2-docker copy "$image_test" "backup/sp-ip-test-$(timestamp)"
    d2-docker stop "$image_test"
    d2-docker copy "$image_pro" "$image_test"

    sudo /usr/local/bin/start-dhis2-test

    wait_for_dhis2_server "$url"
}

main() {
    local url
    url=$(get_url 80)
    start_from_pro
    post_clone "$url"
}

main "$@"
