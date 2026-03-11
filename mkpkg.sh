#!/bin/sh

set -euxo pipefail

package_name="$1"
package_path="./packages/$package_name"

mkdir -p "$package_path"

ln -s ../../LICENSE "$package_path/LICENSE"
ln -s ../../root-tsconfig.json "$package_path/tsconfig.json"
ln -s ../../root-tsconfig.build.json "$package_path/tsconfig.build.json"

cp ./package.base.json "$package_path/package.json"
sed -i "s/name\": \"\"/name\": \"@athidden\/$package_name\"/" "$package_path/package.json"
sed -i "s/directory\": \"\"/directory\": \"packages\/$package_name\"/" "$package_path/package.json"

echo "# @athidden/$package_name" > "$package_path/README.md"

mkdir -p "$package_path/lib"
echo "console.log('hello, world')" > "$package_path/lib/index.ts"

(
  cd "$package_path"
  bun install
  bun run build
)
