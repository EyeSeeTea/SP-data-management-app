#!/bin/bash
set -e -u -o pipefail

name="docker.eyeseetea.com/eyeseetea/dhis2-data:2.36.11.1-sp-ip-pro"
sql_filename="$(basename $name).sql.gz"

echo "Dump DB: $name -> $sql_filename"
sudo -u postgres pg_dump dhis2 | gzip >"$sql_filename"

echo "Create d2-docker image: $name"
sudo d2-docker create data --sql="$sql_filename" "$name" \
    --apps-dir=/home/dhis/config/files/apps/ --documents-dir=/home/dhis/config/files/document/
sudo docker push "$name"
