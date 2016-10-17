$ErrorActionPreference = 'Stop'

npm run build
# Change this to "yarn pack" once #1114 is fixed
npm pack
if (Test-Path dist) {
  rm dist -Recurse
}
mkdir dist
mv yarn-*.tgz dist/pack.tgz

cd dist
tar -xzf pack.tgz --strip 1
rm pack.tgz
# Change this to "yarn install --production" once #1115 is fixed
npm install --production
rm node_modules/*/test -Recurse
rm node_modules/*/dist -Recurse
cd ..
