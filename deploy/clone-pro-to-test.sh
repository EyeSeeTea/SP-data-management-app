#!/bin/bash
set -e -u -o pipefail

# Actions:
#
#   - In PRO: Create docker image and push to Harbor.
#   - In TEST: Pull docker from Harbor and start.

# Requirements: Open vendorlink (spintldhis01, stintldhis01)

cd "$(dirname "$0")"
source "./lib.sh"

run spintldhis01 bash push-pro-docker.sh
run stintldhis01 bash deploy-test-from-pro.sh
