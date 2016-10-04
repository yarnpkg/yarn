$ErrorActionPreference = 'Stop'

npm run build
npm pack
if (Test-Path dist) {
  rm dist -Recurse
}
mkdir dist
mv yarn-*.tgz dist/pack.tgz

cd dist
tar -xzf pack.tgz --strip 1
rm pack.tgz
npm install --production
rm node_modules/*/test -Recurse
rm node_modules/*/dist -Recurse
cd ..
