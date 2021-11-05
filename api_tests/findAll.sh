#!/usr/bin/env bash
source ./variables.sh
curl "${worker_url}/api/todos" -H "authorization: ${api_key}"
