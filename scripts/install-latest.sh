#!/bin/bash
set -e

reset="\e[0m"
red="\e[0;31m"
green="\e[0;32m"
yellow="\e[0;33m"
cyan="\e[0;36m"
white="\e[0;37m"
gpg_key=9D41F3C3

yarn_get_tarball() {
  printf "$cyan> Downloading tarball...$reset\n"
  if [ "$1" = '--nightly' ]; then
    url=https://nightly.yarnpkg.com/latest.tar.gz
  elif [ "$1" = '--version' ]; then
    url="https://yarnpkg.com/downloads/$2/yarn-v$2.tar.gz"
  else
    url=https://yarnpkg.com/latest.tar.gz
  fi
  # Get both the tarball and its GPG signature
  tarball_tmp=`mktemp -t yarn.XXXXXXXXXX.tar.gz`
  curl -L -o "$tarball_tmp#1" "$url{,.asc}"
  yarn_verify_integrity $tarball_tmp

  printf "$cyan> Extracting to ~/.yarn...$reset\n"
  mkdir .yarn
  tar zxf $tarball_tmp -C .yarn --strip 1 # extract tarball
  rm $tarball_tmp{,.asc}
}

# Verifies the GPG signature of the tarball
yarn_verify_integrity() {
  # Check if GPG is installed
  if [[ -z "$(command -v gpg)" ]]; then
    printf "$yellow> WARNING: GPG is not installed, integrity can not be verified!$reset\n"
    return
  fi

  if [ "$YARN_GPG" == "no" ]; then
    printf "$cyan> WARNING: Skipping GPG integrity check!$reset\n"
    return
  fi

  printf "$cyan> Verifying integrity...$reset\n"
  # Grab the public key if it doesn't already exist
  gpg --list-keys $gpg_key >/dev/null 2>&1 || (curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | gpg --import)

  if [ ! -f "$1.asc" ]; then
    printf "$red> Could not download GPG signature for this Yarn release. This means the release can not be verified!$reset\n"
    yarn_verify_or_quit "> Do you really want to continue?"
    return
  fi

  # Actually perform the verification
  if gpg --verify "$1.asc" $1; then
    printf "$green> GPG signature looks good$reset\n"
  else
    printf "$red> GPG signature for this Yarn release is invalid! This is BAD and may mean the release has been tampered with. It is strongly recommended that you report this to the Yarn developers.$reset\n"
    yarn_verify_or_quit "> Do you really want to continue?"
  fi
}

yarn_link() {
  printf "$cyan> Adding to \$PATH...$reset\n"
  YARN_PROFILE="$(yarn_detect_profile)"
  SOURCE_STR="\nexport PATH=\"\$HOME/.yarn/bin:\$PATH\"\n"

  if [ -z "${YARN_PROFILE-}" ] ; then
    printf "$red> Profile not found. Tried ${YARN_PROFILE} (as defined in \$PROFILE), ~/.bashrc, ~/.bash_profile, ~/.zshrc, and ~/.profile.\n"
    echo "> Create one of them and run this script again"
    echo "> Create it (touch ${YARN_PROFILE}) and run this script again"
    echo "   OR"
    printf "> Append the following lines to the correct file yourself:$reset\n"
    command printf "${SOURCE_STR}"
  else
    if ! grep -q 'yarn' "$YARN_PROFILE"; then
      if [[ $YARN_PROFILE == *"fish"* ]]; then
        command fish -c 'set -U fish_user_paths $fish_user_paths ~/.yarn/bin'
      else
        command printf "$SOURCE_STR" >> "$YARN_PROFILE"
      fi
    fi

    printf "$cyan> We've added the following to your $YARN_PROFILE\n"
    echo "> If this isn't the profile of your current shell then please add the following to your correct profile:"
    printf "   $SOURCE_STR$reset\n"

    version=`./.yarn/bin/yarn --version` || (
      printf "$red> Yarn was installed, but doesn't seem to be working :(.$reset\n"
      exit 1;
    )

    printf "$green> Successfully installed Yarn $version! Please open another terminal where the \`yarn\` command will now be available.$reset\n"
  fi
}

yarn_detect_profile() {
  if [ -n "${PROFILE}" ] && [ -f "${PROFILE}" ]; then
    echo "${PROFILE}"
    return
  fi

  local DETECTED_PROFILE
  DETECTED_PROFILE=''
  local SHELLTYPE
  SHELLTYPE="$(basename "/$SHELL")"

  if [ "$SHELLTYPE" = "bash" ]; then
    if [ -f "$HOME/.bashrc" ]; then
      DETECTED_PROFILE="$HOME/.bashrc"
    elif [ -f "$HOME/.bash_profile" ]; then
      DETECTED_PROFILE="$HOME/.bash_profile"
    fi
  elif [ "$SHELLTYPE" = "zsh" ]; then
    DETECTED_PROFILE="$HOME/.zshrc"
  elif [ "$SHELLTYPE" = "fish" ]; then
    DETECTED_PROFILE="$HOME/.config/fish/config.fish"
  fi

  if [ -z "$DETECTED_PROFILE" ]; then
    if [ -f "$HOME/.profile" ]; then
      DETECTED_PROFILE="$HOME/.profile"
    elif [ -f "$HOME/.bashrc" ]; then
      DETECTED_PROFILE="$HOME/.bashrc"
    elif [ -f "$HOME/.bash_profile" ]; then
      DETECTED_PROFILE="$HOME/.bash_profile"
    elif [ -f "$HOME/.zshrc" ]; then
      DETECTED_PROFILE="$HOME/.zshrc"
    elif [ -f "$HOME/.config/fish/config.fish" ]; then
      DETECTED_PROFILE="$HOME/.config/fish/config.fish"
    fi
  fi

  if [ ! -z "$DETECTED_PROFILE" ]; then
    echo "$DETECTED_PROFILE"
  fi
}

yarn_reset() {
  unset -f yarn_install yarn_reset yarn_get_tarball yarn_link yarn_detect_profile yarn_verify_integrity yarn_verify_or_quit
}

yarn_install() {
  printf "${white}Installing Yarn!$reset\n"

  if [ -d "$HOME/.yarn" ]; then
    if [ -n `which yarn` ]; then
      local latest_url
      local specified_version
      local version_type
      if [ "$1" = '--nightly' ]; then
        latest_url=https://nightly.yarnpkg.com/latest-tar-version
        specified_version=`curl -sS $latest_url`
        version_type='latest'
      elif [ "$1" = '--version' ]; then
        specified_version=$2
        version_type='specified'
      else
        latest_url=https://yarnpkg.com/latest-version
        specified_version=`curl -sS $latest_url`
        version_type='latest'
      fi
      yarn_version=`yarn -V`
      yarn_alt_version=`yarn --version`
      if [ "$specified_version" = "$yarn_version" -o "$specified_version" = "$yarn_alt_version" ]; then
        printf "$green> Yarn is already at the $specified_version version.$reset\n"
      else
        rm -rf "$HOME/.yarn"
      fi
    else
      printf "$red> ~/.yarn already exists, possibly from a past Yarn install.$reset\n"
      printf "$red> Remove it (rm -rf ~/.yarn) and run this script again.$reset\n"
      exit 0
    fi
  fi

  yarn_get_tarball $1 $2
  yarn_link
  yarn_reset
}

yarn_verify_or_quit() {
  read -p "$1 [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]
  then
    printf "$red> Aborting$reset\n"
    exit 1
  fi
}

cd ~
yarn_install $1 $2
