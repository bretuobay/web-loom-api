#!/bin/bash
echo "=== API Testing Package Structure ==="
find /home/bretuobay/prjts/web-loom-api/packages/api-testing -type f -name '*.ts' 2>/dev/null
echo "=== Index.ts Content ==="
cat /home/bretuobay/prjts/web-loom-api/packages/api-testing/src/index.ts 2>/dev/null || echo "No index.ts found"
echo "=== Vitest Config ==="
cat /home/bretuobay/prjts/web-loom-api/packages/api-testing/vitest.config.ts 2>/dev/null || echo "No vitest config found"
echo "=== TSConfig ==="
cat /home/bretuobay/prjts/web-loom-api/packages/api-testing/tsconfig.json 2>/dev/null || echo "No tsconfig found"
echo "=== DONE ==="
