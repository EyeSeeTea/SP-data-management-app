#!/bin/bash
script_dir="$(dirname "$(readlink -f "${BASH_SOURCE[0]:-$0}")")"
# shellcheck source=./lib.sh
source "$script_dir/lib.sh"

add_users_to_maintainer_roles() {
    local url=$1
    debug "Add users to maintainer roles"
    local usernames="hlackey,topelt,bpipher,abong,rsaballe,ccampomanes,virikefe,ashettleroe"
    local roles="Metadata Maintainer,User Maintainer"
    local role_refs

    role_refs=$(
        get_user_role_ids "$url" "$roles" | while read -r role_id; do
            echo "{\"id\":\"$role_id\"}"
        done
    )
    local new_roles user_updated
    # shellcheck disable=SC2086
    new_roles="[$(join_by "," $role_refs)]"
    debug "New roles: $new_roles"

    get_user_ids "$url" "$usernames" | while read -r user_id; do
        debug -n "Add roles ($new_roles) to user: ${user_id}... "

        user_updated=$(curl -sS -X GET \
            "$url/api/users/$user_id.json" | jq ".userCredentials.userRoles += ${new_roles}")
        curl -H "Content-Type: application/json" -sS -X PUT \
            "$url/api/users/$user_id" -d "$user_updated" | jq -r '.status'
    done
}

enable_users() {
    local url=$1 usernames=$2
    debug "Enable training users: $usernames"

    get_user_ids "$url" "$usernames" | while read -r user_id; do
        debug "Enable user: ${user_id}"
        curl -H "Content-Type: application/json" -sS -X PATCH \
            "$url/api/users/$user_id" -d '{"userCredentials":{"disabled":false}}'
    done
}

set_email_password() {
    local url=$url
    echo "Set email password"
    curl -sS -H 'Content-Type: text/plain' -u "$auth" \
        "$url/api/systemSettings/keyEmailPassword" \
        -d 'RLIi96f3TJSBsV2h1IO6Vy52ToWzH0' | jq -r '.status'
}

set_logos() {
    local url=$1 folder=$2

    echo "Set logs: url=$url, folder=$folder"

    curl -sS -F "file=@$folder/logo_front.png;type=image/png" \
        -X POST -u "$auth" \
        -H "Content-Type: multipart/form-data" \
        "$url/api/staticContent/logo_front"

    curl -sS -F "file=@$folder/logo_banner.png;type=image/png" \
        -X POST -u "$auth" \
        -H "Content-Type: multipart/form-data" \
        "$url/api/staticContent/logo_banner"
}
