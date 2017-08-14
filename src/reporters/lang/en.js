/* @flow */
/* eslint max-len: 0 */

const messages = {
  upToDate: 'Already up-to-date.',
  folderInSync: 'Folder in sync.',
  nothingToInstall: 'Nothing to install.',
  resolvingPackages: 'Resolving packages',
  checkingManifest: 'Validating package.json',
  fetchingPackages: 'Fetching packages',
  linkingDependencies: 'Linking dependencies',
  rebuildingPackages: 'Rebuilding all packages',
  buildingFreshPackages: 'Building fresh packages',
  cleaningModules: 'Cleaning modules',
  bumpingVersion: 'Bumping version',
  savingHar: 'Saving HAR file: $0',
  answer: 'Answer?',
  usage: 'Usage',
  installCommandRenamed: '`install` has been replaced with `add` to add new dependencies. Run $0 instead.',
  globalFlagRemoved: '`--global` has been deprecated. Please run $0 instead.',
  waitingInstance: 'Waiting for the other yarn instance to finish',
  offlineRetrying: 'There appears to be trouble with your network connection. Retrying...',
  clearedCache: 'Cleared cache.',
  couldntClearPackageFromCache: "Couldn't clear package $0 from cache",
  clearedPackageFromCache: 'Cleared package $0 from cache',
  packWroteTarball: 'Wrote tarball to $0.',

  helpExamples: '  Examples:\n$0\n',
  helpCommands: '  Commands:\n$0\n',
  helpCommandsMore: '  Run `$0` for more information on specific commands.',
  helpLearnMore: '  Visit $0 to learn more about Yarn.\n',

  manifestPotentialTypo: 'Potential typo $0, did you mean $1?',
  manifestBuiltinModule: '$0 is also the name of a node core module',
  manifestNameDot: "Name can't start with a dot",
  manifestNameIllegalChars: 'Name contains illegal characters',
  manifestNameBlacklisted: 'Name is blacklisted',
  manifestLicenseInvalid: 'License should be a valid SPDX license expression',
  manifestLicenseNone: 'No license field',
  manifestStringExpected: '$0 is not a string',
  manifestDependencyCollision:
    '$0 has dependency $1 with range $2 that collides with a dependency in $3 of the same name with version $4',
  manifestDirectoryNotFound: 'Unable to read $0 directory of module $1',

  verboseFileCopy: 'Copying $0 to $1.',
  verboseFileLink: 'Creating hardlink at $0 to $1.',
  verboseFileSymlink: 'Creating symlink at $0 to $1.',
  verboseFileSkip: 'Skipping copying of file $0 as the file at $1 is the same size ($2) and mtime ($3).',
  verboseFileSkipSymlink: 'Skipping copying of $0 as the file at $1 is the same symlink ($2).',
  verboseFileSkipHardlink: 'Skipping copying of $0 as the file at $1 is the same hardlink ($2).',
  verboseFileRemoveExtraneous: 'Removing extraneous file $0.',
  verboseFilePhantomExtraneous:
    "File $0 would be marked as extraneous but has been removed as it's listed as a phantom file.",
  verboseFileFolder: 'Creating directory $0.',

  verboseRequestStart: 'Performing $0 request to $1.',
  verboseRequestFinish: 'Request $0 finished with status code $1.',

  configSet: 'Set $0 to $1.',
  configDelete: 'Deleted $0.',
  configNpm: 'npm config',
  configYarn: 'yarn config',

  couldntFindPackagejson: "Couldn't find a package.json file in $0",
  couldntFindMatch: "Couldn't find match for $0 in $1 for $2.",
  couldntFindPackageInCache: "Couldn't find any versions for $0 that matches $1 in our cache. Possible versions: $2",
  couldntFindVersionThatMatchesRange: "Couldn't find any versions for $0 that matches $1",
  chooseVersionFromList: 'Please choose a version of $0 from this list:',
  moduleNotInManifest: "This module isn't specified in a manifest.",
  unknownFolderOrTarball: "Passed folder/tarball doesn't exist,",
  unknownPackage: "Couldn't find package $0.",
  unknownPackageName: "Couldn't find package name.",
  unknownUser: "Couldn't find user $0.",
  unknownRegistryResolver: 'Unknown registry resolver $0',
  userNotAnOwner: "User $0 isn't an owner of this package.",
  invalidVersionArgument: 'Use the $0 flag to create a new version.',
  invalidVersion: 'Invalid version supplied.',
  requiredVersionInRange: 'Required version in range.',
  packageNotFoundRegistry: "Couldn't find package $0 on the $1 registry.",
  doesntExist: "$0 doesn't exist.",
  missingRequiredPackageKey: `Package $0 doesn't have a $1.`,
  invalidAccess: 'Invalid argument for access, expected public or restricted.',
  invalidCommand: 'Invalid subcommand. Try $0',
  invalidGistFragment: 'Invalid gist fragment $0.',
  invalidHostedGitFragment: 'Invalid hosted git fragment $0.',
  invalidFragment: 'Invalid fragment $0.',
  invalidPackageName: 'Invalid package name.',
  couldntFindManifestIn: "Couldn't find manifest in $0.",
  shrinkwrapWarning:
    'npm-shrinkwrap.json found. This will not be updated or respected. See https://yarnpkg.com/en/docs/migrating-from-npm for more information.',
  lockfileOutdated: 'Outdated lockfile. Please run `yarn install` and try again.',
  lockfileMerged: 'Merge conflict detected in yarn.lock and successfully merged.',
  lockfileConflict:
    'A merge conflict was found in yarn.lock but it could not be successfully merged, regenerating yarn.lock from scratch.',
  ignoredScripts: 'Ignored scripts due to flag.',
  missingAddDependencies: 'Missing list of packages to add to your project.',
  yesWarning:
    'The yes flag has been set. This will automatically answer yes to all questions which may have security implications.',
  networkWarning:
    "You don't appear to have an internet connection. Try the --offline flag to use the cache for registry queries.",
  flatGlobalError:
    'The package $0@$1 requires a flat dependency graph. Add `"flat": true` to your package.json and try again.',
  noName: `Package doesn't have a name.`,
  noVersion: `Package doesn't have a version.`,
  answerRequired: 'An answer is required.',
  missingWhyDependency: 'Missing package name, folder or path to file to identify why a package has been installed',
  bugReport: 'If you think this is a bug, please open a bug report with the information provided in $0.',
  unexpectedError: 'An unexpected error occurred: $0.',
  jsonError: 'Error parsing JSON at $0, $1.',
  noFilePermission: "We don't have permissions to touch the file $0.",
  allDependenciesUpToDate: 'All of your dependencies are up to date.',
  legendColorsForUpgradeInteractive:
    'Color legend : \n $0    : Patch Update backward-compatible bug fixes \n $1 : Minor Update backward-compatible features',
  frozenLockfileError: 'Your lockfile needs to be updated, but yarn was run with `--frozen-lockfile`.',
  fileWriteError: 'Could not write file $0: $1',
  multiplePackagesCantUnpackInSameDestination:
    'Pattern $0 is trying to unpack in the same destination $1 as pattern $2. This could result in a non deterministic behavior, skipping.',
  incorrectLockfileEntry: 'Lockfile has incorrect entry for $0. Ignoring it.',

  invalidResolutionName: 'Resolution field $0 does not end with a valid package name and will be ignored',
  invalidResolutionVersion: 'Resolution field $0 has an invalid version entry and may be ignored',
  incompatibleResolutionVersion: 'Resolution field $0 is incompatible with requested version $1',

  yarnOutdated: "Your current version of Yarn is out of date. The latest version is $0 while you're on $1.",
  yarnOutdatedInstaller: 'To upgrade, download the latest installer at $0.',
  yarnOutdatedCommand: 'To upgrade, run the following command:',

  tooManyArguments: 'Too many arguments, maximum of $0.',
  tooFewArguments: 'Not enough arguments, expected at least $0.',
  noArguments: "This command doesn't require any arguments.",

  ownerRemoving: 'Removing owner $0 from package $1.',
  ownerRemoved: 'Owner removed.',
  ownerRemoveError: "Couldn't remove owner.",
  ownerGetting: 'Getting owners for package $0',
  ownerGettingFailed: "Couldn't get list of owners.",
  ownerAlready: 'This user is already an owner of this package.',
  ownerAdded: 'Added owner.',
  ownerAdding: 'Adding owner $0 to package $1',
  ownerAddingFailed: "Couldn't add owner.",
  ownerNone: 'No owners.',

  teamCreating: 'Creating team',
  teamRemoving: 'Removing team',
  teamAddingUser: 'Adding user to team',
  teamRemovingUser: 'Removing user from team',
  teamListing: 'Listing teams',

  cleaning: 'Cleaning modules',
  cleanCreatingFile: 'Creating $0',

  binLinkCollision:
    "There's already a linked binary called $0 in your global Yarn bin. Could not link this package's $0 bin entry.",
  linkCollision: "There's already a module called $0 registered.",
  linkMissing: 'No registered module found called $0.',
  linkRegistered: 'Registered $0.',
  linkRegisteredMessage:
    'You can now run `yarn link $0` in the projects where you want to use this module and it will be used instead.',
  linkUnregistered: 'Unregistered $0.',
  linkUnregisteredMessage:
    'You can now run `yarn unlink $0` in the projects where you no longer want to use this module.',
  linkUsing: 'Using linked module for $0.',
  linkDisusing: 'Removed linked module $0.',
  linkDisusingMessage: 'You will need to run `yarn` to re-install the package that was linked.',

  createInvalidBin: 'Invalid bin entry found in package $0.',
  createMissingPackage:
    'Package not found - this is probably an internal error, and should be reported at https://github.com/yarnpkg/yarn/issues.',

  workspacesRequirePrivateProjects: 'Workspaces can only be enabled in private projects',
  workspaceExperimentalDisabled:
    'The workspace feature is currently experimental and needs to be manually enabled - please add "workspaces-experimental true" to your .yarnrc file.',
  workspaceRootNotFound: "Cannot find the root of your workspace - are you sure you're currently in a workspace?",
  workspaceMissingWorkspace: 'Missing workspace name.',
  workspaceMissingCommand: 'Missing command name.',
  workspaceUnknownWorkspace: 'Unknown workspace $0.',
  workspaceVersionMandatory: 'Missing version in workspace at $0, ignoring.',
  workspaceNameMandatory: 'Missing name in workspace at $0, ignoring.',
  workspaceNameDuplicate: 'There are more than one workspace with name $0',

  execMissingCommand: 'Missing command name.',

  commandNotSpecified: 'No command specified.',
  binCommands: 'Commands available from binary scripts: ',
  possibleCommands: 'Project commands',
  commandQuestion: 'Which command would you like to run?',
  commandFailedWithCode: 'Command failed with exit code $0.',
  commandFailedWithSignal: 'Command failed with signal $0.',
  packageRequiresNodeGyp:
    'This package requires node-gyp, which is not currently installed. Yarn will attempt to automatically install it. If this fails, you can run "yarn global add node-gyp" to manually install it.',
  nodeGypAutoInstallFailed:
    'Failed to auto-install node-gyp. Please run "yarn global add node-gyp" manually. Error: $0',

  foundIncompatible: 'Found incompatible module',
  incompatibleEngine: 'The engine $0 is incompatible with this module. Expected version $1.',
  incompatibleCPU: 'The CPU architecture $0 is incompatible with this module.',
  incompatibleOS: 'The platform $0 is incompatible with this module.',
  invalidEngine: 'The engine $0 appears to be invalid.',

  optionalCompatibilityExcluded:
    '$0 is an optional dependency and failed compatibility check. Excluding it from installation.',
  optionalModuleFail: 'This module is OPTIONAL, you can safely ignore this error',
  optionalModuleScriptFail: 'Error running install script for optional dependency: $0',
  optionalModuleCleanupFail: 'Could not cleanup build artifacts from failed install: $0',

  unmetPeer: '$0 has unmet peer dependency $1.',
  incorrectPeer: '$0 has incorrect peer dependency $1.',
  missingBundledDependency: '$0 is missing a bundled dependency $1. This should be reported to the package maintainer.',

  savedNewDependency: 'Saved 1 new dependency.',
  savedNewDependencies: 'Saved $0 new dependencies.',

  foundWarnings: 'Found $0 warnings.',
  foundErrors: 'Found $0 errors.',

  notSavedLockfileNoDependencies: 'Lockfile not saved, no dependencies.',

  savedLockfile: 'Saved lockfile.',
  noRequiredLockfile: 'No lockfile in this directory. Run `yarn install` to generate one.',
  noLockfileFound: 'No lockfile found.',

  invalidSemver: 'Invalid semver version',
  newVersion: 'New version',
  currentVersion: 'Current version',

  manualVersionResolution:
    'Unable to find a suitable version for $0, please choose one by typing one of the numbers below:',
  manualVersionResolutionOption: '$0 which resolved to $1',

  createdTag: 'Created tag.',
  createdTagFail: "Couldn't add tag.",
  deletedTag: 'Deleted tag.',
  deletedTagFail: "Couldn't delete tag.",
  gettingTags: 'Getting tags',
  deletingTags: 'Deleting tag',
  creatingTag: 'Creating tag $0 = $1',

  whyStart: 'Why do we have the module $0?',
  whyFinding: 'Finding dependency',
  whyCalculating: 'Calculating file sizes',
  whyUnknownMatch: "We couldn't find a match!",
  whyInitGraph: 'Initialising dependency graph',
  whyWhoKnows: "We don't know why this module exists",
  whyDiskSizeWithout: 'Disk size without dependencies: $0',
  whyDiskSizeUnique: 'Disk size with unique dependencies: $0',
  whyDiskSizeTransitive: 'Disk size with transitive dependencies: $0',
  whySharedDependencies: 'Number of shared dependencies: $0',
  whyHoistedTo: `Has been hoisted to $0`,

  whyHoistedFromSimple: `This module exists because it's hoisted from $0.`,
  whyDependedOnSimple: `This module exists because $0 depends on it.`,
  whySpecifiedSimple: `This module exists because it's specified in $0.`,
  whyReasons: 'Reasons this module exists',
  whyHoistedFrom: 'Hoisted from $0',
  whyDependedOn: '$0 depends on it',
  whySpecified: `Specified in $0`,

  uninstalledPackages: 'Uninstalled packages.',
  uninstallRegenerate: 'Regenerating lockfile and installing missing dependencies',

  cleanRemovedFiles: 'Removed $0 files',
  cleanSavedSize: 'Saved $0 MB.',

  configFileFound: 'Found configuration file $0.',
  configPossibleFile: 'Checking for configuration file $0.',

  npmUsername: 'npm username',
  npmPassword: 'npm password',
  npmEmail: 'npm email',

  loggingIn: 'Logging in',
  loggedIn: 'Logged in.',
  notRevokingEnvToken: 'Not revoking login token, specified via environment variable.',
  notRevokingConfigToken: 'Not revoking login token, specified via config file.',
  noTokenToRevoke: 'No login token to revoke.',
  revokingToken: 'Revoking token',
  revokedToken: 'Revoked login token.',

  loginAsPublic: 'Logging in as public',
  incorrectCredentials: 'Incorrect username or password.',
  clearedCredentials: 'Cleared login credentials.',

  publishFail: "Couldn't publish package.",
  publishPrivate: 'Package marked as private, not publishing.',
  published: 'Published.',
  publishing: 'Publishing',

  infoFail: 'Received invalid response from npm.',
  malformedRegistryResponse: 'Received malformed response from registry for $0. The registry may be down.',

  cantRequestOffline: "Can't make a request in offline mode ($0)",
  requestManagerNotSetupHAR: 'RequestManager was not setup to capture HAR files',
  requestError: 'Request $0 returned a $1',
  requestFailed: 'Request failed $0',
  tarballNotInNetworkOrCache: '$0: Tarball is not in network and can not be located in cache ($1)',
  fetchBadHashWithPath: "Hashes don't match when extracting file $0. Expected $1 but got $2",
  fetchErrorCorrupt:
    '$0. Mirror tarball appears to be corrupt. You can resolve this by running:\n\n  rm -rf $1\n  yarn install',
  errorDecompressingTarball: '$0. Error decompressing $1, it appears to be corrupt.',
  updateInstalling: 'Installing $0...',
  hostedGitResolveError: 'Error connecting to repository. Please, check the url.',
  retryOnInternalServerError: 'There appears to be trouble with our server. Retrying...',

  unknownFetcherFor: 'Unknown fetcher for $0',

  refusingDownloadGitWithoutCommit: 'Refusing to download the git repo $0 over plain git without a commit hash',
  refusingDownloadHTTPWithoutCommit: 'Refusing to download the git repo $0 over HTTP without a commit hash',
  refusingDownloadHTTPSWithoutCommit:
    'Refusing to download the git repo $0 over HTTPS without a commit hash - possible certificate error?',

  packageInstalledWithBinaries: 'Installed $0 with binaries:',
  packageHasBinaries: '$0 has binaries:',
  packageHasNoBinaries: '$0 has no binaries',

  couldBeDeduped: '$0 could be deduped from $1 to $2',
  lockfileNotContainPattern: 'Lockfile does not contain pattern: $0',
  integrityCheckFailed: 'Integrity check failed',
  noIntegrityFile: "Couldn't find an integrity file",
  integrityFailedExpectedIsNotAJSON: 'Integrity check: integrity file is not a json',
  integrityCheckLinkedModulesDontMatch: "Integrity check: Linked modules don't match",
  integrityFlagsDontMatch: "Integrity check: Flags don't match",
  integrityLockfilesDontMatch: "Integrity check: Lock files don't match",
  integrityFailedFilesMissing: 'Integrity check: Files are missing',
  integrityPatternsDontMatch: "Integrity check: Top level patterns don't match",
  integrityModulesFoldersMissing: 'Integrity check: Some module folders are missing',
  packageNotInstalled: '$0 not installed',
  optionalDepNotInstalled: 'Optional dependency $0 not installed',
  packageWrongVersion: '$0 is wrong version: expected $1, got $2',
  packageDontSatisfy: "$0 doesn't satisfy found match of $1",

  lockfileExists: 'Lockfile already exists, not importing.',
  skippingImport: 'Skipping import of $0 for $1',
  importFailed: 'Import of $0 for $1 failed, resolving normally.',
  importResolveFailed: 'Import of $0 failed starting in $1',
  importResolvedRangeMatch: 'Using version $0 of $1 instead of $2 for $3',
  packageContainsYarnAsGlobal:
    'Installing Yarn via Yarn will result in you having two separate versions of Yarn installed at the same time, which is not recommended. To update Yarn please follow https://yarnpkg.com/en/docs/install .',

  scopeNotValid: 'The specified scope is not valid.',

  deprecatedCommand: '$0 is deprecated. Please use $1.',
};

export type LanguageKeys = $Keys<typeof messages>;
export default messages;
