#!/usr/bin/env bash
source ./variables.sh
curl "${worker_url}/api/todos?id=${1}" -H "authorization: ${api_key}"
