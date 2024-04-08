#!/bin/bash
set -e -u -o pipefail

# Actions:
#
#   - Save last projects for 60 days in training instance.
#   - Clone instance in proj-dhis-prod to localhost.
#   - Setup of the local docker + recover training projects

# Requirements: Open vendorlink before running the script:
#
#   $ vendorlink sp-proj-dhis-test-00.clt1.theark.cloud sp-proj-dhis-prod-00.clt1.theark.cloud

cd "$(dirname "$0")"
source "./lib.sh"

#run sp-proj-dhis-test-00.clt1.theark.cloud sudo usermod -a -G docker asanchez

run boone-ip-pro bash push-pro-docker.sh
#run boone-ip-test bash start-training-from-pro.sh
