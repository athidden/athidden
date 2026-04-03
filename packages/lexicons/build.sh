#!/bin/sh

if command -v bunx &>/dev/null; then
  runner=bunx
elif command -v npx &>/dev/null; then
  runner=npx
else
  echo "error: 'bunx' or 'npx' not found" >&2
  exit 1
fi

if ! command -v goat &>/dev/null; then
  echo "error: 'goat' not found" >&2
  exit 1
fi

echo "---- removing dist, lib, lexicons"
rm -rf dist lib lexicons

echo "---- lex-cli generate"
$runner lex-cli generate

echo "---- lex-cli export"
$runner lex-cli export

echo "---- goat lex parse"
goat lex parse lexicons/ooo/bsky/**/*.json

echo "---- goat lex publish"
goat lex publish --update --lexicons-dir ./lexicons

echo "---- tsc"
$runner tsc --project tsconfig.build.json

echo "---- done!"
