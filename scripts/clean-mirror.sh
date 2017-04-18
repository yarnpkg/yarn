#!/usr/bin/env bash

# This script finds all packages located inside an offline mirror, all packages referenced by yarn.lock files, and remove those which aren't referenced anymore.
# The first argument is the directory where your offline mirror lives, and the second one is the location where the script should recursively start looking for yarn.lock files.
# If you only have a single project in your mirror, you can use the purge configuration to automatically remove packages from it as they are dereferenced (`yarn config set yarn-offline-mirror-pruning true`).

set -e

DRY_RUN=0
MAKE_STATS=0

OPTIND=1; while getopts "ds" opt; do
    case "$opt" in
        d) DRY_RUN=1;;
        s) MAKE_STATS=1;;
    esac
done

shift $((OPTIND-1))

if [[ "$#" -ne 2 ]] || ! [[ -d "$1" ]] || ! [[ -d "$2" ]]; then
    echo "Usage: $0 <offline mirror path> <projects common path>" >&2
    exit 1
fi

TEMP=$(mktemp -d)
trap "rm -rf $TEMP" EXIT

MIRROR="$1"
SOURCES="$2"

# Find all yarn.lock files in the source directory
find "${SOURCES}" -type f -name yarn.lock > "${TEMP}.ylocks"

# Extract the part right before the hash, and remove duplicates
xargs cat < "${TEMP}.ylocks" | grep -E '^[ \t]*resolved[ \t]+' | perl -pe 's/^(?:[^\/ \n]*[\/ ])*([^#]*)#.*$/\1/gm' | sort | uniq > "${TEMP}.deps"

# Obtain the list of package filenames from the specified directory
find "${MIRROR}" -maxdepth 1 \( -type f -a -not -name '.*' \) -exec basename {} \; | sort > "${TEMP}.files"

# Compute the list of files that are in the directory but not in the dependencies
comm -13 "${TEMP}.deps" "${TEMP}.files" > "${TEMP}.diff"

# Get the number of lockfiles we've found
ylocks=$(wc -l < "${TEMP}.ylocks" | grep -oE [0-9]+)

# Compute the total number of files in the directory
total=$(wc -l < "${TEMP}.files" | grep -oE [0-9]+)

# Early exits if we have no diff
diff=$(wc -l < "${TEMP}.diff" | grep -oE [0-9]+)

if [[ $diff -eq 0 ]]; then

    echo "No garbage found." >&2
    exit 0

elif [[ $ylocks -eq 0 ]]; then

    echo "No lockfiles found. If this is to be expected, please just remove the offline mirror by hand." >&2
    exit 125

else

    # If in dry run, we can just print this list and exits
    if [[ $DRY_RUN -eq 1 ]]; then

        if [[ $diff -eq $total ]]; then
            echo "Assertion failed: running this script would remove all packages."
            echo
        fi

        echo "# Lockfiles"
        echo
        cat "${TEMP}.ylocks"
        echo
        echo "# Unreferenced packages"
        echo
        cat "${TEMP}.diff"

        if [[ $MAKE_STATS -eq 1 ]]; then
            size=$(cd "${MIRROR}" && xargs -n1 wc -c < "${TEMP}.diff" | awk '{s+=$1}END{print s}')
            echo
            echo "Removing them would free about $(numfmt --to=iec-i --suffix=B --format="%.3f" $size)"
        fi

        if [[ $diff -eq $total ]]; then
            exit 1
        else
            exit 0
        fi

    else

        if [[ $diff -eq $total ]]; then

            echo "Assertion failed: running this script would remove all packages." >&2
            exit 1

        else

            # Compute the extensions used by the soon-to-be-removed files
            exts=$(grep -oE '(\.[a-z]+)+$' < "${TEMP}.diff" | sort | uniq | paste -sd ', ' -)

            # Check with the user that everything is ok
            response=
            while ! [[ $response =~ ^(yes|y|no|n)$ ]]; do
                read -r -p "This command will remove ${diff} file(s) (extensions are: ${exts}). Are you sure? [Y/n] " response < /dev/tty
                response=$(tr '[:upper:]' '[:lower:]' <<< "${response}")
            done

            if [[ $response =~ ^(yes|y)$ ]]; then
                cd "${MIRROR}"
                sed 's/\r\n?/\n/g' < "${TEMP}.diff" | while read -r filename; do
                    echo "Removing ${filename}..."
                    rm "${filename}"
                done
            fi

            exit 0

        fi

    fi

fi
