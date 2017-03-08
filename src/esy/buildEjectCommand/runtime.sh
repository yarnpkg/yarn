set -e
set -u
set -o pipefail

if [ "$TMPDIR" == "" ]; then
  unset TMPDIR
fi

OS='POSIX'
if [ "$OS" == 'POSIX' ]; then
  CIRCLE='◯'
  CIRCLE_FILLED='◉'
  CIRCLE_DOTTED='◌'
else
  CIRCLE='( )'
  CIRCLE_FILLED='(*)'
  CIRCLE_DOTTED='( )'
fi
# See https://github.com/sindresorhus/figures


FG_RED='\033[0;31m'
FG_GREEN='\033[0;32m'
FG_WHITE='\033[1;37m'
FG_RESET='\033[0m'

ESY__SANDBOX_COMMAND=""

if [[ "$esy__platform" == "darwin" ]]; then
  ESY__SANDBOX_COMMAND="sandbox-exec -f $cur__target_dir/_esy/sandbox.sb"
fi

_esy-prepare-build-env () {

  rm -rf $cur__install

  # prepare build and installation directory
  mkdir -p                \
    $cur__target_dir      \
    $cur__install         \
    $cur__lib             \
    $cur__bin             \
    $cur__sbin            \
    $cur__man             \
    $cur__doc             \
    $cur__share           \
    $cur__etc

  # for in-source builds copy sources over to build location
  if [ "$esy_build__type" == "in-source" ]; then
    rm -rf $cur__root;
    rsync --quiet --archive $esy_build__source_root/ $cur__root --exclude $cur__root;
  fi

  mkdir -p $cur__target_dir/_esy
  $ESY__EJECT_ROOT/bin/render-env $esy_build__eject/findlib.conf.in $cur__target_dir/_esy/findlib.conf
  $ESY__EJECT_ROOT/bin/render-env $esy_build__eject/sandbox.sb.in $cur__target_dir/_esy/sandbox.sb

}

_esy-perform-build () {

  _esy-prepare-build-env

  cd $cur__root

  echo -e "${FG_WHITE} $CIRCLE $cur__name: building from source...${FG_RESET}"
  BUILD_LOG="$cur__target_dir/_esy/build.log"
  set +e
  $ESY__SANDBOX_COMMAND /bin/bash   \
    --noprofile --norc              \
    -e -u -o pipefail               \
    -c "$esy_build__command"        \
    > "$BUILD_LOG" 2>&1
  BUILD_RETURN_CODE="$?"
  set -e
  if [ "$BUILD_RETURN_CODE" != "0" ]; then
    if [ "$esy_build__source_type" == "local" ] || [ ! -z "${CI+x}" ] ; then
      echo -e "${FG_RED} $CIRCLE_DOTTED $cur__name: build failed:\n"
      cat "$BUILD_LOG" | sed  's/^/  /'
      echo -e "${FG_RESET}"
    else
      echo -e "${FG_RED} $CIRCLE_DOTTED $cur__name: build failed, see:\n\n  $BUILD_LOG\n\nfor details${FG_RESET}"
    fi
    esy-clean
    exit 1
  else
    for filename in `find $cur__install -type f`; do
      $ESY__EJECT_ROOT/bin/replace-string "$filename" "$cur__install" "$esy_build__install"
    done
    mv $cur__install $esy_build__install
    echo -e "${FG_GREEN} $CIRCLE_FILLED $cur__name: build complete${FG_RESET}"
  fi

}

esy-build () {
  if [ "$esy_build__source_type" == "local" ]; then
    esy-clean
    _esy-perform-build
  else
    if [ ! -d "$esy_build__install" ]; then
      _esy-perform-build
    fi
  fi
}

esy-shell () {
  _esy-prepare-build-env
  $ESY__SANDBOX_COMMAND /bin/bash   \
    --noprofile                     \
    --rcfile <(echo "
      export PS1=\"[$cur__name sandbox] $ \";
      source $ESY__EJECT_ROOT/bin/runtime.sh;
      set +e
      set +u
      set +o pipefail
      cd $cur__root
    ")
}

esy-clean () {
  rm -rf $esy_build__install
}
