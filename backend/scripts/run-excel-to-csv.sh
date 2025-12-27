#!/bin/bash
cd "$(dirname "$0")/.."
npm run excel-to-csv -- "$@"

