#!/bin/bash
set -e -u -o pipefail

cd "$(dirname "$0")"
script_dir=$(pwd)
source "./lib.sh"
source "./tasks.sh"

load_training_projects() {
    local url=$1
    cd "$script_dir/project-monitoring-app" || return 1
    yarn ts-node src/scripts/projects.ts --url="$url" import training-projects.json
}

training_post_clone() {
    local url=$1
    set_email_password "$url"
    enable_users "$url" "traindatareviewer,traindataviewer,traindataentry"
    change_server_name "$url" "SP Platform - Training"
    add_users_to_maintainer_roles "$url"
    set_logos "$url" "$script_dir/training"
}

get_app_version() {
    local url=$1
    curl -sS -u "$auth" "$url/api/apps" |
        jq '.[] | select(.key == "Data-Management-App").version' -r
}

get_project_monitoring_app_source() {
    local url=$1
    local repo_url="https://github.com/eyeseetea/project-monitoring-app"

    app_version=$(get_app_version "$url")
    cd "$script_dir" || return 1
    git clone "$repo_url" "project-monitoring-app" || true
    cd "project-monitoring-app" || return 1

    git fetch
    git checkout v"$app_version" -f
    yarn install
    yarn add ts-node@10.8.1
    yarn localize
}

save_last_training_projects() {
    local url=$1
    date=$(date --date="60 day ago" "+%Y-%m-%d")
    cd "$script_dir/project-monitoring-app" || return 1
    yarn ts-node src/scripts/projects.ts --url="$url" --from="$date" export training-projects.json
}

delete_projects() {
    d2-docker run-sql -i $image_training "$script_dir/clone-scripts/create-guest-user.sql"
    d2-docker run-sql -i $image_training "$script_dir/clone-scripts/sql-01.empty_data_tables_228.sql"
    d2-docker run-sql -i $image_training "$script_dir/clone-scripts/sql-02.delete-projects.sql"
}

start_from_pro() {
    d2-docker pull "$image_pro"
    d2-docker commit "$image_training"
    d2-docker copy "$image_training" "backup/sp-ip-training-$(timestamp)"
    d2-docker stop "$image_training"
    d2-docker copy "$image_pro" "$image_training"

    sudo /usr/local/bin/start-dhis2-training

    wait_for_dhis2_server "$url"
}

main() {
    url=$(get_url 81)

    get_project_monitoring_app_source "$url"
    save_last_training_projects "$url"
    start_from_pro
    delete_projects
    load_training_projects "$url"
    training_post_clone "$url"
}

main "$@"
