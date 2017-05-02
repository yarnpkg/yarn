// Jenkins build jobs for Yarn
// https://build.dan.cx/view/Yarn/

job('yarn-version') {
  description 'Updates the version number on the Yarn website'
  label 'linux'
  authenticationToken "${YARN_VERSION_KEY}"
  scm {
    git {
      branch 'master'
      remote {
        github 'yarnpkg/website', 'ssh'
      }
      extensions {
        // Required so we can commit to master
        // http://stackoverflow.com/a/29786580/210370
        localBranch 'master'
      }
    }
  }
  parameters {
    stringParam 'YARN_VERSION'
    booleanParam 'YARN_RC'
  }
  steps {
    shell '''
      ./scripts/set-version.sh
      git commit -m "Automated upgrade to Yarn $YARN_VERSION" _config.yml
    '''
  }
  publishers {
    git {
      branch 'origin', 'master'
      pushOnlyIfSuccess
    }
    downstreamParameterized {
      // Other jobs to run when version number is bumped
      trigger([
        'yarn-chocolatey',
        'yarn-homebrew',
      ]) {
        parameters {
          currentBuild()
        }
      }
    }
    gitHubIssueNotifier {
    }
  }
}

matrixJob('yarn-e2e') {
  displayName 'Yarn End To End'
  description 'Nightly end-to-end tests for Yarn'
  scm {
    github 'yarnpkg/yarn', 'master'
  }
  triggers {
    cron '@midnight'
  }
  axes {
    text 'os', 'ubuntu-16.04', 'ubuntu-14.04', 'ubuntu-12.04'
    label 'label', 'docker' // Only run on build hosts that have Docker
  }
  steps {
    // 192.168.122.1:3142 is apt-cacher-ng on the Docker host
    shell '''
      cd end_to_end_tests
      APT_PROXY=192.168.122.1:3142 ./test-$os.sh
    '''
  }
  publishers {
    gitHubIssueNotifier {
    }
  }
}

job('yarn-chocolatey') {
  displayName 'Yarn Chocolatey'
  description 'Ensures the Chocolatey package for Yarn is up-to-date'
  label 'windows'
  scm {
    github 'yarnpkg/yarn', 'master'
  }
  parameters {
    // Passed from yarn-version job
    stringParam 'YARN_VERSION'
    booleanParam 'YARN_RC'
  }
  steps {
    powerShell '.\\scripts\\build-chocolatey.ps1 -Publish'
  }
  publishers {
    gitHubIssueNotifier {
    }
  }
}

job('yarn-homebrew') {
  description 'Ensures the Homebrew package for Yarn is up-to-date'
  label 'linuxbrew'
  scm {
    github 'yarnpkg/yarn', 'master'
  }
  parameters {
    // Passed from yarn-version job
    stringParam 'YARN_VERSION'
    booleanParam 'YARN_RC'
  }
  steps {
    shell './scripts/update-homebrew.sh'
  }
  publishers {
    gitHubIssueNotifier {
    }
  }
}
