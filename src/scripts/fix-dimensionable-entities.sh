#!/bin/bash
#
# Set shortName for all dimensionable entities (children of entities with flag 'dataDimensions'):
#
#  - category -> categoryOptions
#  - categoryOptionGroupSet -> categoryOptionGroups
#  - dataElementGroupSet -> dataElementGroups
#  - optionGroupSet -> optionGroups
#  - organisationUnitGroupSet -> organisationUnitGroups

# Usage:
#
#   $ export IP_ADMIN_AUTH=admin:PASSWORD
#   $ src/scripts/fix-dimensionable-entities.sh http://localhost:8080 "admin:PASSWORD"

debug() {
    echo "$@" >&2
}

curl2() {
    debug "curl" "$@"
    curl -g -sS -u "$IP_ADMIN_AUTH" "$@"
}

curl_post() {
    curl2 -H "Content-Type: application/json" -X POST "$@"
}

post_metadata() {
    local url=$1 file=$2
    curl_post "$url/api/metadata?dryRun=${DRY_RUN:-false}" -d@"$file" | jq |
        tee metadata-res.json | jq -c '[.status, .stats]' >&2
}

set_default_short_name() {
    local url=$1 model=$2
    local count
    debug "Set default shortName: model=$model"

    curl2 "$url/api/$model.json?paging=false&fields=:owner" | jq --sort-keys >"metadata-$model.json"

    cat "metadata-$model.json" |
        jq --arg model "$model" '
            .[$model] as $records |
              $records |
              map(select(.code != "default")) |
              map(. * {shortName: (.shortName // .name)}) |
              (. - $records) |
              {($model): .}
        ' >"metadata2-$model.json"

    count=$(cat "metadata2-$model.json" | jq --arg model "$model" '.[$model] | length')
    debug "$model:POST-count: $count"

    if test "$count" -gt 0; then
        post_metadata "$url" ""metadata2-$model.json""
    fi
}

models=(
    categoryOptions
    categoryOptionGroups
    dataElementGroups
    optionGroups
    organisationUnitGroups
)

main() {
    set -e -u -o pipefail
    local url=$1 password=$2
    export IP_ADMIN_AUTH=${password}

    for model in "${models[@]}"; do
        set_default_short_name "$url" "$model"
    done
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
