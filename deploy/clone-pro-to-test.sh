#!/bin/bash
set -e -u -o pipefail

# Actions:
#
#   - Clone instance in proj-dhis-prod to localhost.
#   - Setup of the local docker

# Requirements: Open vendorlink (ip-pro + ip-tst) before running the script:

cd "$(dirname "$0")"
source "./lib.sh"

#run boone-ip-pro bash push-pro-docker.sh
run boone-ip-test bash deploy-test-from-pro.sh
