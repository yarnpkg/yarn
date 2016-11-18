# sometimes folders may not exist according to node/npm version etc so ignore them
$ErrorActionPreference = 'Continue'

# random browser builds that aren't used
rm node_modules/core-js/client -Recurse

# remove typescript files
rm node_modules/rx/ts -Recurse

# naughty modules that have their test folders
rm node_modules/*/test -Recurse
