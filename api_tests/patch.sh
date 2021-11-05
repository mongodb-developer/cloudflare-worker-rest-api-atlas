#!/usr/bin/env bash
source ./variables.sh
curl -X PATCH "${worker_url}/api/todos?id=${1}&done=${2}" -H "authorization: ${api_key}"
