#!/bin/bash
script_dir="$(dirname "$(readlink -f "${BASH_SOURCE[0]:-$0}")")"
source "$script_dir/auth.sh"

export image_pro="docker.eyeseetea.com/eyeseetea/dhis2-data:2.36.11.1-sp-ip-pro"
export image_test="docker.eyeseetea.com/samaritans/dhis2-data:2.36.11.1-sp-ip-test"
export image_dev="docker.eyeseetea.com/samaritans/dhis2-data:2.36.11.1-sp-ip-dev"
export image_training="docker.eyeseetea.com/samaritans/dhis2-data:2.36.11.1-sp-ip-training"

debug() {
    echo "$@" >&2
}

get_url() {
    local port=$1
    echo "http://$auth@localhost:$port"
}

run() {
    local host=$1
    local command=$2
    shift 2

    debug "Copy deploy folder"
    rsync -a . "$host":deploy/
    debug "Run: $command $*"
    ssh "$host" "cd deploy &&" "$command" "$@"
}

wait_for_dhis2_server() {
    local url=$url
    local port
    port=$(echo "$url" | grep -o ':[[:digit:]]*$' | cut -d: -f2)
    echo "Wait for server: port=$port"

    while ! curl -sS -f "http://localhost:$port"; do
        sleep 10
    done
}

timestamp() {
    date "+%Y-%m-%d_%H-%M"
}

get_user_ids() {
    local url=$1 usernames=$2
    local get_users_url="$url/api/users.json?filter=userCredentials.username:in:[${usernames}]"

    curl -g -sS "$get_users_url" | jq -r '.users[].id'
}

get_user_role_ids() {
    local url=$1 names=$2
    local get_user_roles_url="$url/api/userRoles.json"

    curl -G -g -sS "$get_user_roles_url" \
        --data-urlencode "filter=name:in:[${names}]" | jq -r '.userRoles[].id'
}

change_server_name() {
    local url=$1 title=$2
    debug "Change server name: $title"
    curl -sS -X POST "$url/api/systemSettings/applicationTitle" \
        -d "$title" -H "Content-Type: application/json"
}

join_by() {
    local IFS="$1"
    shift
    echo "$*"
}
