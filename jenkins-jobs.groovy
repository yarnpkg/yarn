// Jenkins build jobs for Yarn
// https://build.dan.cx/view/Yarn/

/**
 * Trigger that fires when a new stable Yarn version is released
 * This could probably be smarter in the future (eg. handle it using a webhook
 * rather than polling the version number)
 */
def yarnStableVersionChange = {
  triggerContext -> triggerContext.with {
    urlTrigger {
      cron 'H/15 * * * *'
      url('https://yarnpkg.com/latest-version') {
        inspection 'change'
      }
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
  triggers {
    yarnStableVersionChange delegate
  }
  steps {
    powerShell '.\\scripts\\build-chocolatey.ps1 -Publish'
  }
  publishers {
    gitHubIssueNotifier {
    }
    mailer 'yarn@dan.cx'
  }
}
