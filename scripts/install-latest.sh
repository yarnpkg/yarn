#!/bin/sh
set -e

reset="\e[0m"
red="\e[0;31m"
green="\e[0;32m"
cyan="\e[0;36m"
white="\e[0;37m"

yarn_get_tarball() {
  printf "$cyan> Downloading tarball...$reset\n"
  curl -L -o yarn.tar.gz "https://yarnpkg.com/latest.tar.gz" >/dev/null # get tarball

  printf "$cyan> Extracting to ~/.yarn...$reset\n"
  mkdir .yarn
  tar zxf yarn.tar.gz -C .yarn --strip 1 # extract tarball
  rm -rf yarn.tar.gz # remove tarball
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

    printf "$green> Successfully installed! Please open another terminal where the \`yarn\` command will now be available.$reset\n"
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
  unset -f yarn_install yarn_reset yarn_get_tarball yarn_link yarn_detect_profile
}

yarn_install() {
  printf "${white}Installing Yarn!$reset\n"

  if [ -d "$HOME/.yarn" ]; then
    printf "$red> ~/.yarn already exists, possibly from a past Yarn install.$reset\n"
    printf "$red> Remove it (rm -rf ~/.yarn) and run this script again.$reset\n"
    exit 0
  fi

  yarn_get_tarball
  yarn_link
  yarn_reset
}

cd ~
yarn_install
