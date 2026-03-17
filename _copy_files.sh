#!/bin/bash
BASE=/home/bretuobay/prjts/web-loom-api
SRC="$BASE/wsl.localhost/Ubuntu-24.04/home/bretuobay/prjts/web-loom-api"
cp "$SRC/packages/api-testing/src/model-serializer.ts" "$BASE/packages/api-testing/src/model-serializer.ts"
cp "$SRC/packages/api-testing/src/__tests__/property-tests.test.ts" "$BASE/packages/api-testing/src/__tests__/property-tests.test.ts"
rm -rf "$BASE/wsl.localhost"
echo "FILES_COPIED"
