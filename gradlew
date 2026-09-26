#!/usr/bin/env sh

if command -v gradle >/dev/null 2>&1; then
    exec gradle "$@"
else
    echo "ERROR: Gradle is not installed or not in PATH." >&2
    exit 1
fi
