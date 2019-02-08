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
  waitingInstance: 'Waiting for the other yarn instance to finish (pid $0, inside $1)',
  waitingNamedInstance: 'Waiting for the other yarn instance to finish ($0)',
  offlineRetrying: 'There appears to be trouble with your network connection. Retrying...',
  internalServerErrorRetrying: 'There appears to be trouble with the npm registry (returned $1). Retrying...',
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
  verboseFileSkipArtifact: 'Skipping copying of $0 as the file is marked as a built artifact and subject to change.',
  verboseFileFolder: 'Creating directory $0.',

  verboseRequestStart: 'Performing $0 request to $1.',
  verboseRequestFinish: 'Request $0 finished with status code $1.',

  configSet: 'Set $0 to $1.',
  configDelete: 'Deleted $0.',
  configNpm: 'npm config',
  configYarn: 'yarn config',

  couldntFindPackagejson: "Couldn't find a package.json file in $0",
  couldntFindMatch: "Couldn't find match for $0 in $1 for $2.",
  couldntFindPackageInCache:
    "Couldn't find any versions for $0 that matches $1 in our cache (possible versions are $2). This is usually caused by a missing entry in the lockfile, running Yarn without the --offline flag may help fix this issue.",
  couldntFindVersionThatMatchesRange: "Couldn't find any versions for $0 that matches $1",
  chooseVersionFromList: 'Please choose a version of $0 from this list:',
  moduleNotInManifest: "This module isn't specified in a package.json file.",
  moduleAlreadyInManifest: '$0 is already in $1. Please remove existing entry first before adding it to $2.',
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
  requiredPackageNotFoundRegistry: "Couldn't find package $0 required by $1 on the $2 registry.",
  doesntExist: "Package $1 refers to a non-existing file '$0'.",
  missingRequiredPackageKey: `Package $0 doesn't have a $1.`,
  invalidAccess: 'Invalid argument for access, expected public or restricted.',
  invalidCommand: 'Invalid subcommand. Try $0',
  invalidGistFragment: 'Invalid gist fragment $0.',
  invalidHostedGitFragment: 'Invalid hosted git fragment $0.',
  invalidFragment: 'Invalid fragment $0.',
  invalidPackageName: 'Invalid package name.',
  invalidPackageVersion: "Can't add $0: invalid package version $1.",
  couldntFindManifestIn: "Couldn't find manifest in $0.",
  shrinkwrapWarning:
    'npm-shrinkwrap.json found. This will not be updated or respected. See https://yarnpkg.com/en/docs/migrating-from-npm for more information.',
  npmLockfileWarning:
    'package-lock.json found. Your project contains lock files generated by tools other than Yarn. It is advised not to mix package managers in order to avoid resolution inconsistencies caused by unsynchronized lock files. To clear this warning, remove package-lock.json.',
  lockfileOutdated: 'Outdated lockfile. Please run `yarn install` and try again.',
  lockfileMerged: 'Merge conflict detected in yarn.lock and successfully merged.',
  lockfileConflict:
    'A merge conflict was found in yarn.lock but it could not be successfully merged, regenerating yarn.lock from scratch.',
  ignoredScripts: 'Ignored scripts due to flag.',
  missingAddDependencies: 'Missing list of packages to add to your project.',
  yesWarning:
    'The yes flag has been set. This will automatically answer yes to all questions, which may have security implications.',
  networkWarning:
    "You don't appear to have an internet connection. Try the --offline flag to use the cache for registry queries.",
  flatGlobalError:
    'The package $0 requires a flat dependency graph. Add `"flat": true` to your package.json and try again.',
  noName: `Package doesn't have a name.`,
  noVersion: `Package doesn't have a version.`,
  answerRequired: 'An answer is required.',
  missingWhyDependency: 'Missing package name, folder or path to file to identify why a package has been installed',
  bugReport: 'If you think this is a bug, please open a bug report with the information provided in $0.',
  unexpectedError: 'An unexpected error occurred: $0.',
  jsonError: 'Error parsing JSON at $0, $1.',
  noPermission: 'Cannot create $0 due to insufficient permissions.',
  noGlobalFolder: 'Cannot find a suitable global folder. Tried these: $0',
  allDependenciesUpToDate: 'All of your dependencies are up to date.',
  legendColorsForVersionUpdates:
    'Color legend : \n $0    : Major Update backward-incompatible updates \n $1 : Minor Update backward-compatible features \n $2  : Patch Update backward-compatible bug fixes',
  frozenLockfileError: 'Your lockfile needs to be updated, but yarn was run with `--frozen-lockfile`.',
  fileWriteError: 'Could not write file $0: $1',
  multiplePackagesCantUnpackInSameDestination:
    'Pattern $0 is trying to unpack in the same destination $1 as pattern $2. This could result in non-deterministic behavior, skipping.',
  incorrectLockfileEntry: 'Lockfile has incorrect entry for $0. Ignoring it.',

  invalidResolutionName: 'Resolution field $0 does not end with a valid package name and will be ignored',
  invalidResolutionVersion: 'Resolution field $0 has an invalid version entry and may be ignored',
  incompatibleResolutionVersion: 'Resolution field $0 is incompatible with requested version $1',

  yarnOutdated: "Your current version of Yarn is out of date. The latest version is $0, while you're on $1.",
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
  cleanCreatedFile:
    'Created $0. Please review the contents of this file then run "yarn autoclean --force" to perform a clean.',
  cleanAlreadyExists: '$0 already exists. To revert to the default file, delete $0 then rerun this command.',
  cleanRequiresForce:
    'This command required the "--force" flag to perform the clean. This is a destructive operation. Files specified in $0 will be deleted.',
  cleanDoesNotExist:
    '$0 does not exist. Autoclean will delete files specified by $0. Run "autoclean --init" to create $0 with the default entries.',

  binLinkCollision:
    "There's already a linked binary called $0 in your global Yarn bin. Could not link this package's $0 bin entry.",
  linkCollision:
    "There's already a package called $0 registered. This command has had no effect. If this command was run in another folder with the same name, the other folder is still linked. Please run yarn unlink in the other folder if you want to register this folder.",
  linkMissing: 'No registered package found called $0.',
  linkRegistered: 'Registered $0.',
  linkRegisteredMessage:
    'You can now run `yarn link $0` in the projects where you want to use this package and it will be used instead.',
  linkUnregistered: 'Unregistered $0.',
  linkUnregisteredMessage:
    'You can now run `yarn unlink $0` in the projects where you no longer want to use this package.',
  linkUsing: 'Using linked package for $0.',
  linkDisusing: 'Removed linked package $0.',
  linkDisusingMessage: 'You will need to run `yarn install --force` to re-install the package that was linked.',
  linkTargetMissing: 'The target of linked package $0 is missing. Removing link.',

  createInvalidBin: 'Invalid bin entry found in package $0.',
  createMissingPackage:
    'Package not found - this is probably an internal error, and should be reported at https://github.com/yarnpkg/yarn/issues.',

  workspacesAddRootCheck:
    'Running this command will add the dependency to the workspace root rather than the workspace itself, which might not be what you want - if you really meant it, make it explicit by running this command again with the -W flag (or --ignore-workspace-root-check).',
  workspacesRemoveRootCheck:
    'Running this command will remove the dependency from the workspace root rather than the workspace itself, which might not be what you want - if you really meant it, make it explicit by running this command again with the -W flag (or --ignore-workspace-root-check).',
  workspacesFocusRootCheck: 'This command can only be run inside an individual workspace.',
  workspacesRequirePrivateProjects: 'Workspaces can only be enabled in private projects.',
  workspacesSettingMustBeArray: 'The workspaces field in package.json must be an array.',
  workspacesDisabled:
    'Your project root defines workspaces but the feature is disabled in your Yarn config. Please check "workspaces-experimental" in your .yarnrc file.',

  workspacesNohoistRequirePrivatePackages:
    'nohoist config is ignored in $0 because it is not a private package. If you think nohoist should be allowed in public packages, please submit an issue for your use case.',
  workspacesNohoistDisabled: `$0 defines nohoist but the feature is disabled in your Yarn config ("workspaces-nohoist-experimental" in .yarnrc file)`,

  workspaceRootNotFound: "Cannot find the root of your workspace - are you sure you're currently in a workspace?",
  workspaceMissingWorkspace: 'Missing workspace name.',
  workspaceMissingCommand: 'Missing command name.',
  workspaceUnknownWorkspace: 'Unknown workspace $0.',
  workspaceVersionMandatory: 'Missing version in workspace at $0, ignoring.',
  workspaceNameMandatory: 'Missing name in workspace at $0, ignoring.',
  workspaceNameDuplicate: 'There are more than one workspace with name $0',

  cacheFolderSkipped: 'Skipping preferred cache folder $0 because it is not writable.',
  cacheFolderMissing:
    "Yarn hasn't been able to find a cache folder it can use. Please use the explicit --cache-folder option to tell it what location to use, or make one of the preferred locations writable.",
  cacheFolderSelected: 'Selected the next writable cache folder in the list, will be $0.',

  execMissingCommand: 'Missing command name.',

  noScriptsAvailable: 'There are no scripts specified inside package.json.',
  noBinAvailable: 'There are no binary scripts available.',
  dashDashDeprecation: `From Yarn 1.0 onwards, scripts don't require "--" for options to be forwarded. In a future version, any explicit "--" will be forwarded as-is to the scripts.`,
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
  incompatibleEngine: 'The engine $0 is incompatible with this module. Expected version $1. Got $2',
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
  selectedPeer: 'Selecting $1 at level $2 as the peer dependency of $0.',
  missingBundledDependency: '$0 is missing a bundled dependency $1. This should be reported to the package maintainer.',

  savedNewDependency: 'Saved 1 new dependency.',
  savedNewDependencies: 'Saved $0 new dependencies.',
  directDependencies: 'Direct dependencies',
  allDependencies: 'All dependencies',

  foundWarnings: 'Found $0 warnings.',
  foundErrors: 'Found $0 errors.',

  savedLockfile: 'Saved lockfile.',
  noRequiredLockfile: 'No lockfile in this directory. Run `yarn install` to generate one.',
  noLockfileFound: 'No lockfile found.',

  invalidSemver: 'Invalid semver version',
  newVersion: 'New version',
  currentVersion: 'Current version',
  noVersionOnPublish: 'Proceeding with current version',

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
  whyNotHoistedSimple: `This module exists here because it's in the nohoist list $0.`,
  whyDependedOnSimple: `This module exists because $0 depends on it.`,
  whySpecifiedSimple: `This module exists because it's specified in $0.`,
  whyReasons: 'Reasons this module exists',
  whyHoistedFrom: 'Hoisted from $0',
  whyNotHoisted: `in the nohoist list $0`,
  whyDependedOn: '$0 depends on it',
  whySpecified: `Specified in $0`,

  whyMatch: `\r=> Found $0`,

  uninstalledPackages: 'Uninstalled packages.',
  uninstallRegenerate: 'Regenerating lockfile and installing missing dependencies',

  cleanRemovedFiles: 'Removed $0 files',
  cleanSavedSize: 'Saved $0 MB.',

  configFileFound: 'Found configuration file $0.',
  configPossibleFile: 'Checking for configuration file $0.',

  npmUsername: 'npm username',
  npmPassword: 'npm password',
  npmEmail: 'npm email',
  npmOneTimePassword: 'npm one-time password',

  loggingIn: 'Logging in',
  loggedIn: 'Logged in.',
  notRevokingEnvToken: 'Not revoking login token, specified via environment variable.',
  notRevokingConfigToken: 'Not revoking login token, specified via config file.',
  noTokenToRevoke: 'No login token to revoke.',
  revokingToken: 'Revoking token',
  revokedToken: 'Revoked login token.',

  loginAsPublic: 'Logging in as public',
  incorrectCredentials: 'Incorrect username or password.',
  incorrectOneTimePassword: 'Incorrect one-time password.',
  twoFactorAuthenticationEnabled: 'Two factor authentication enabled.',
  clearedCredentials: 'Cleared login credentials.',

  publishFail: "Couldn't publish package: $0",
  publishPrivate: 'Package marked as private, not publishing.',
  published: 'Published.',
  publishing: 'Publishing',

  nonInteractiveNoVersionSpecified:
    'You must specify a new version with --new-version when running with --non-interactive.',
  nonInteractiveNoToken: "No token found and can't prompt for login when running with --non-interactive.",

  infoFail: 'Received invalid response from npm.',
  malformedRegistryResponse: 'Received malformed response from registry for $0. The registry may be down.',
  registryNoVersions: 'No valid versions found for $0. The package may be unpublished.',

  cantRequestOffline: "Can't make a request in offline mode ($0)",
  requestManagerNotSetupHAR: 'RequestManager was not setup to capture HAR files',
  requestError: 'Request $0 returned a $1',
  requestFailed: 'Request failed $0',
  tarballNotInNetworkOrCache: '$0: Tarball is not in network and can not be located in cache ($1)',
  fetchBadHashWithPath: "Integrity check failed for $0 (computed integrity doesn't match our records, got $2)",
  fetchBadIntegrityAlgorithm: 'Integrity checked failed for $0 (none of the specified algorithms are supported)',
  fetchErrorCorrupt:
    '$0. Mirror tarball appears to be corrupt. You can resolve this by running:\n\n  rm -rf $1\n  yarn install',
  errorExtractingTarball: 'Extracting tar content of $1 failed, the file appears to be corrupt: $0',
  updateInstalling: 'Installing $0...',
  hostedGitResolveError: 'Error connecting to repository. Please, check the url.',

  unknownFetcherFor: 'Unknown fetcher for $0',

  downloadGitWithoutCommit: 'Downloading the git repo $0 over plain git without a commit hash',
  downloadHTTPWithoutCommit: 'Downloading the git repo $0 over HTTP without a commit hash',

  unplugDisabled: "Packages can only be unplugged when Plug'n'Play is enabled.",

  plugnplayWindowsSupport: "Plug'n'Play on Windows doesn't support the cache and project to be kept on separate drives",

  packageInstalledWithBinaries: 'Installed $0 with binaries:',
  packageHasBinaries: '$0 has binaries:',
  packageHasNoBinaries: '$0 has no binaries',
  packageBinaryNotFound: "Couldn't find a binary named $0",

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
  integritySystemParamsDontMatch: "Integrity check: System parameters don't match",
  packageNotInstalled: '$0 not installed',
  optionalDepNotInstalled: 'Optional dependency $0 not installed',
  packageWrongVersion: '$0 is wrong version: expected $1, got $2',
  packageDontSatisfy: "$0 doesn't satisfy found match of $1",

  lockfileExists: 'Lockfile already exists, not importing.',
  skippingImport: 'Skipping import of $0 for $1',
  importFailed: 'Import of $0 for $1 failed, resolving normally.',
  importResolveFailed: 'Import of $0 failed starting in $1',
  importResolvedRangeMatch: 'Using version $0 of $1 instead of $2 for $3',
  importSourceFilesCorrupted: 'Failed to import from package-lock.json, source file(s) corrupted',
  importPackageLock: 'found npm package-lock.json, converting to yarn.lock',
  importNodeModules: 'creating yarn.lock from local node_modules folder',
  packageContainsYarnAsGlobal:
    'Installing Yarn via Yarn will result in you having two separate versions of Yarn installed at the same time, which is not recommended. To update Yarn please follow https://yarnpkg.com/en/docs/install .',

  scopeNotValid: 'The specified scope is not valid.',

  deprecatedCommand: '$0 is deprecated. Please use $1.',
  deprecatedListArgs: 'Filtering by arguments is deprecated. Please use the pattern option instead.',
  implicitFileDeprecated:
    'Using the "file:" protocol implicitly is deprecated. Please either prepend the protocol or prepend the path $0 with "./".',
  unsupportedNodeVersion:
    'You are using Node $0 which is not supported and may encounter bugs or unexpected behavior. Yarn supports the following semver range: $1',

  verboseUpgradeBecauseRequested: 'Considering upgrade of $0 to $1 because it was directly requested.',
  verboseUpgradeBecauseOutdated: 'Considering upgrade of $0 to $1 because a newer version exists in the registry.',
  verboseUpgradeNotUnlocking: 'Not unlocking $0 in the lockfile because it is a new or direct dependency.',
  verboseUpgradeUnlocking: 'Unlocking $0 in the lockfile.',
  folderMissing: "Directory $0 doesn't exist",
  mutexPortBusy: 'Cannot use the network mutex on port $0. It is probably used by another app.',

  auditRunning: 'Auditing packages',
  auditSummary: '$0 vulnerabilities found - Packages audited: $1',
  auditSummarySeverity: 'Severity:',
  auditCritical: '$0 Critical',
  auditHigh: '$0 High',
  auditModerate: '$0 Moderate',
  auditLow: '$0 Low',
  auditInfo: '$0 Info',
  auditResolveCommand: '# Run $0 to resolve $1 $2',
  auditSemverMajorChange: 'SEMVER WARNING: Recommended action is a potentially breaking change',
  auditManualReview:
    'Manual Review\nSome vulnerabilities require your attention to resolve\n\nVisit https://go.npm.me/audit-guide for additional guidance',
  auditRunAuditForDetails: 'Security audit found potential problems. Run "yarn audit" for additional details.',
  auditOffline: 'Skipping audit. Security audit cannot be performed in offline mode.',
};

export type LanguageKeys = $Keys<typeof messages>;
export default messages;
