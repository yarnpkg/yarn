/* @flow */
/* eslint max-len: 0 */

/* This file has been organized and alphabetized for ease of maintenance and use.
 * It will also help when the file is being translated to another language as it
 * can be broken down by command. The naming pattern is simply a prefix of the
 * command the string is associated with, "common" if it is shared, and "core"
 * if it is used by the index itself.
 */

const messages = {
  addAllDependencies: 'All dependencies',
  addDirectDependencies: 'Direct dependencies',
  addMissingAddDependencies: 'Missing list of packages to add to your project.',
  addModuleAlreadyInManifest: '$0 is already in $1. Please remove existing entry first before adding it to $2.',
  addSavedNewDependency: 'Saved 1 new dependency.',
  addSavedNewDependencies: 'Saved $0 new dependencies.',
  addWorkspacesAddRootCheck:
    'Running this command will add the dependency to the workspace root rather than the workspace itself, which might not be what you want - if you really meant it, make it explicit by running this command again with the -W flag (or --ignore-workspace-root-check).',

  autoCleanAlreadyExists: '$0 already exists. To revert to the default file, delete $0 then rerun this command.',
  autoCleanCleaning: 'Cleaning modules',
  autoCleanCreatingFile: 'Creating $0',
  autoCleanCreatedFile:
    'Created $0. Please review the contents of this file then run `yarn autoclean --force` to perform a clean.',
  autoCleanDoesNotExist:
    '$0 does not exist. Autoclean will delete files specified by $0. Run `autoclean --init` to create $0 with the default entries.',
  autoCleanSavedSize: 'Saved $0 MB.',
  autoCleanRequiresForce:
    'This command required the `--force` flag to perform the clean. This is a destructive operation. Files specified in $0 will be deleted.',
  autoCleanRemovedFiles: 'Removed $0 files',

  binPackageBinaryNotFound: 'Could not find a binary named $0',

  buildSubCommandsInvalidCommand: 'Invalid sub-command. Try $0',
  buildSubCommandsUsage: 'Usage',

  cacheClearedCache: 'Cleared cache.',
  cacheClearedPackageFromCache: 'Cleared package $0 from cache',

  checkCouldBeDeduped: '$0 could be deduped from $1 to $2',
  checkFolderInSync: 'Folder in sync.',
  checkFoundWarnings: 'Found $0 warnings.',
  checkFoundErrors: 'Found $0 errors.',
  checkIntegrityCheckFailed: 'Integrity check failed',
  checkLockfileNotContainPattern: 'Lockfile does not contain pattern: $0',
  checkNoIntegrityFile: 'Could not find an integrity file',
  checkOptionalDepNotInstalled: 'Optional dependency $0 not installed',
  checkPackageDoesntSatisfy: '$0 does not satisfy found match of $1',
  checkPackageNotInstalled: '$0 not installed',
  checkPackageWrongVersion: '$0 is wrong version: expected $1, got $2',

  commonInvalidPackageName: 'Invalid package name.',
  commonLegendColorsForVersionUpdates:
    'Legend : \n $0 : Major Update backward-incompatible updates \n $1 : Minor Update backward-compatible features \n $2 : Patch Update backward-compatible bug fixes \n',
  commonLoggingIn: 'Logging in',
  commonNoArguments: 'This command does not require any arguments.',
  commonNoPackageName: 'Package does not have a name.',
  commonNoPackageVersion: 'Package does not have a version.',
  commonPackageNotFoundRegistry: 'Could not find package $0 on the $1 registry.',
  commonRevokingToken: 'Revoking token',
  commonTooFewArguments: 'Not enough arguments, expected at least $0.',
  commonTooManyArguments: 'Too many arguments, maximum of $0.',
  commonUnknownPackage: 'Could not find package $0.',
  commonUnknownPackageName: 'Could not find package name.',

  configCacheFolderMissing:
    'Yarn has not been able to find a cache folder it can use. Please use the explicit --cache-folder option to tell it what location to use, or make one of the preferred locations writable.',
  configDelete: 'Deleted $0.',
  configCacheFolderSelected: 'Selected the next writable cache folder in the list, will be $0.',
  configCacheFolderSkipped: 'Skipping preferred cache folder $0 because it is not writable.',
  configFolderMissing: 'Directory $0 does not exist',
  configJsonError: 'Error parsing JSON at $0, $1.',
  configNoPackageJson: 'Could not find a package.json file in $0',
  configNpm: 'npm config',
  configPlugNPlayWindowsSupport:
    'Plug-n-Play is ignored on Windows for now - contributions welcome! https://github.com/yarnpkg/yarn/issues/6402',
  configSet: 'Set $0 to $1.',
  configWorkspacesFocusRootCheck: 'This command can only be run inside an individual workspace.',
  configWorkspacesRequirePrivateProjects: 'Workspaces can only be enabled in private projects.',
  configWorkspacesSettingMustBeArray: 'The workspaces field in package.json must be an array.',
  configWorkspacesDisabled:
    'Your project root defines workspaces but the feature is disabled in your Yarn config. Please check `workspaces-experimental` in your .yarnrc file.',
  configWorkspaceNameDuplicate: 'There are more than one workspace with name $0',
  configWorkspaceNameMandatory: 'Missing name in workspace at $0, ignoring.',
  configWorkspacesNoHoistRequirePrivatePackages:
    'nohoist config is ignored in $0 because it is not a private package. If you think nohoist should be allowed in public packages, please submit an issue for your use case.',
  configWorkspacesNoHoistDisabled:
    '$0 defines nohoist but the feature is disabled in your Yarn config (`workspaces-nohoist-experimental` in .yarnrc file)',
  configWorkspaceVersionMandatory: 'Missing version in workspace at $0, ignoring.',
  configYarn: 'yarn config',

  consoleReporterAnswerRequired: 'An answer is required.',

  coreBugReport: 'If you think this is a bug, please open a bug report with the information provided in $0.',
  coreDoubleDashDeprecation:
    'From Yarn 1.0 onwards, scripts do not require `--` for options to be forwarded. In a future version, any explicit `--` will be forwarded as-is to the scripts.',
  coreFileWriteError: 'Could not write file $0: $1',
  coreMutexPortBusy: 'Cannot use the network mutex on port $0. It is probably used by another app.',
  coreNetworkWarning:
    'You do not appear to have an internet connection. Try the --offline flag to use the cache for registry queries.',
  coreNoRequiredLockfile: 'No lockfile in this directory. Run `yarn install` to generate one.',
  coreUnexpectedError: 'An unexpected error occurred: $0.',
  coreUnsupportedNodeVersion:
    'You are using Node $0 which is not supported and may encounter bugs or unexpected behavior. Yarn supports the following semver range: $1',
  coreWaitingInstance: 'Waiting for the other yarn instance to finish (pid $0, inside $1)',
  coreWaitingNamedInstance: 'Waiting for the other yarn instance to finish ($0)',
  coreYesWarning:
    'The yes flag has been set. This will automatically answer yes to all questions, which may have security implications.',

  execMissingCommand: 'Missing command name.',

  executeLifecycleScriptCommandFailedWithCode: 'Command failed with exit code $0.',
  executeLifecycleScriptCommandFailedWithSignal: 'Command failed with signal $0.',
  executeLifecycleScriptPackageRequiresNodeGyp:
    'This package requires node-gyp, which is not currently installed. Yarn will attempt to automatically install it. If this fails, you can run `yarn global add node-gyp` to manually install it.',
  executeLifecycleScriptNodeGypAutoInstallFailed:
    'Failed to auto-install node-gyp. Please run `yarn global add node-gyp` manually. Error: $0',

  fetchersTarballNotInNetworkOrCache: '$0: Tarball is not in network and can not be located in cache ($1)',
  fetchersBadHashWithPath: 'Integrity check failed for $0 (computed integrity does not match our records, got $2)',
  fetchersErrorCorrupt:
    '$0. Mirror tarball appears to be corrupt. You can resolve this by running:\n\n  rm -rf $1\n  yarn install',

  fileResolverPackageDoesntExist: 'Package $1 refers to a non-existing file `$0`.',

  gistResolverInvalidGistFragment: 'Invalid gist fragment $0.',

  getDownloadGitWithoutCommit: 'Downloading the git repo $0 over plain git without a commit hash',
  getDownloadHttpWithoutCommit: 'Downloading the git repo $0 over HTTP without a commit hash',
  gitNoMatch: 'Could not find match for $0 in $1 for $2.',

  globalNoFolder: 'Cannot find a suitable global folder. Tried these: $0',
  globalNoPermission: 'Cannot create $0 due to insufficient permissions.',
  globalPackageContainsYarnAsGlobal:
    'Installing Yarn via Yarn will result in you having two separate versions of Yarn installed at the same time, which is not recommended. To update Yarn please follow https://yarnpkg.com/en/docs/install .',
  globalPackageHasBinaries: '$0 has binaries:',
  globalPackageHasNoBinaries: '$0 has no binaries',
  globalPackageInstalledWithBinaries: 'Installed $0 with binaries:',

  helpCommands: '  Commands:\n$0\n',
  helpCommandsMore: '  Run `$0` for more information on specific commands.',
  helpExamples: '  Examples:\n$0\n',
  helpLearnMore: '  Visit $0 to learn more about Yarn.\n',

  hostedGitResolverError: 'Error connecting to repository. Please, check the url.',
  hostedGitResolverInvalidHostedGitFragment: 'Invalid hosted git fragment $0.',

  importLockfileExists: 'Lockfile already exists, not importing.',
  importSkipping: 'Skipping import of $0 for $1',
  importFailed: 'Import of $0 for $1 failed, resolving normally.',
  importResolveFailed: 'Import of $0 failed starting in $1',
  importResolvedRangeMatch: 'Using version $0 of $1 instead of $2 for $3',
  importSourceFilesCorrupted: 'Failed to import from package-lock.json, source file(s) corrupted',
  importPackageLock: 'found npm package-lock.json, converting to yarn.lock',
  importNodeModules: 'creating yarn.lock from local node_modules folder',

  infoFail: 'Received invalid response from npm.',

  installAnswerPrompt: 'Answer?',
  installBuildingFreshPackages: 'Building fresh packages',
  installCheckingManifest: 'Validating package.json',
  installCleaningModules: 'Cleaning modules',
  installCommandRenamed: '`install` has been replaced with `add` to add new dependencies. Run $0 instead.',
  installFetchingPackages: 'Fetching packages',
  installFrozenLockfileError: 'Your lockfile needs to be updated, but yarn was run with `--frozen-lockfile`.',
  installNpmLockfileWarning:
    'package-lock.json found. Your project contains lock files generated by tools other than Yarn. It is advised not to mix package managers in order to avoid resolution inconsistencies caused by unsynchronized lock files. To clear this warning, remove package-lock.json.',
  installGlobalFlagRemoved: '`--global` has been deprecated. Please run $0 instead.',
  installIgnoredScripts: 'Ignored scripts due to flag.',
  installLinkingDependencies: 'Linking dependencies',
  installManualVersionResolution:
    'Unable to find a suitable version for $0, please choose one by typing one of the numbers below:',
  installManualVersionResolutionOption: '$0 which resolved to $1',
  installNothingToInstall: 'Nothing to install.',
  installRebuildingPackages: 'Rebuilding all packages',
  installResolvingPackages: 'Resolving packages',
  installSavedLockfile: 'Saved lockfile.',
  installSavingHar: 'Saving HAR file: $0',
  installShrinkWrapWarning:
    'npm-shrinkwrap.json found. This will not be updated or respected. See https://yarnpkg.com/en/docs/migrating-from-npm for more information.',
  installUpToDate: 'Already up-to-date.',
  installYarnOutdated: 'Your current version of Yarn is out of date. The latest version is $0, while you are on $1.',
  installYarnOutdatedInstaller: 'To upgrade, download the latest installer at $0.',
  installYarnOutdatedCommand: 'To upgrade, run the following command:',

  integrityCheckerFileNotJson: 'Integrity check: integrity file is not a json',
  integrityCheckerLinkedModulesDontMatch: 'Integrity check: Linked modules do not match',
  integrityCheckerFlagsDontMatch: 'Integrity check: Flags do not match',
  integrityCheckerLockfilesDontMatch: 'Integrity check: Lock files do not match',
  integrityCheckerFailedFilesMissing: 'Integrity check: Files are missing',
  integrityCheckerPatternsDontMatch: 'Integrity check: Top level patterns do not match',
  integrityCheckerModulesFoldersMissing: 'Integrity check: Some module folders are missing',
  integrityCheckerSystemParamsDontMatch: 'Integrity check: System parameters do not match',

  linkBinCollision:
    'There is already a linked binary called $0 in your global Yarn bin. Could not link the current package $0 bin entry.',
  linkCollision:
    'There is already a package called $0 registered. This command has had no effect. If this command was run in another folder with the same name, the other folder is still linked. Please run yarn unlink in the other folder if you want to register this folder.',
  linkDisusing: 'Removed linked package $0.',
  linkDisusingMessage: 'You will need to run `yarn` to re-install the package that was linked.',
  linkMissing: 'No registered package found called $0.',
  linkRegistered: 'Registered $0.',
  linkRegisteredMessage:
    'You can now run `yarn link $0` in the projects where you want to use this package and it will be used instead.',
  linkTargetMissing: 'The target of linked package $0 is missing. Removing link.',
  linkUnregistered: 'Unregistered $0.',
  linkUnregisteredMessage:
    'You can now run `yarn unlink $0` in the projects where you no longer want to use this package.',
  linkUsing: 'Using linked package for $0.',

  listDeprecatedArgs: 'Filtering by arguments is deprecated. Please use the pattern option instead.',

  lockfileConflict:
    'A merge conflict was found in yarn.lock but it could not be successfully merged, regenerating yarn.lock from scratch.',
  lockfileMerged: 'Merge conflict detected in yarn.lock and successfully merged.',
  lockfileNotFound: 'No lockfile found.',

  loginAsPublic: 'Logging in as public',
  loginLoggedIn: 'Logged in.',
  loginIncorrectCredentials: 'Incorrect username or password.',
  loginNoTokenToRevoke: 'No login token to revoke.',
  loginNonInteractiveNoToken: 'No token found and cannot prompt for login when running with --non-interactive.',
  loginNotRevokingEnvToken: 'Not revoking login token, specified via environment variable.',
  loginNotRevokingConfigToken: 'Not revoking login token, specified via config file.',
  loginNpmEmail: 'npm email',
  loginNpmPassword: 'npm password',
  loginNpmUsername: 'npm username',
  loginRevokedToken: 'Revoked login token.',

  logoutClearedCredentials: 'Cleared login credentials.',

  manifestBuiltinModule: '$0 is also the name of a node core module',
  manifestDependencyCollision:
    '$0 has dependency $1 with range $2 that collides with a dependency in $3 of the same name with version $4',
  manifestDirectoryNotFound: 'Unable to read $0 directory of module $1',
  manifestPotentialTypo: 'Potential typo $0, did you mean $1?',
  manifestLicenseInvalid: 'License should be a valid SPDX license expression',
  manifestLicenseNone: 'No license field',
  manifestNameDot: 'Name cannot start with a dot',
  manifestNameIllegalChars: 'Name contains illegal characters',
  manifestNameBlacklisted: 'Name is blacklisted',
  manifestStringExpected: '$0 is not a string',

  npmRegistryConfigFileFound: 'Found configuration file $0.',
  npmRegistryConfigPossibleFile: 'Checking for configuration file $0.',

  npmResolverChooseVersionFromList: 'Please choose a version of $0 from this list:',
  npmResolverMalformedRegistryResponse: 'Received malformed response from registry for $0. The registry may be down.',
  npmResolverNoPackageInCache:
    'Could not find any versions for $0 that matches $1 in our cache (possible versions are $2). This is usually caused by a missing entry in the lockfile, running Yarn without the --offline flag may help fix this issue.',
  npmResolverNoVersionMatchesRange: 'Could not find any versions for $0 that matches $1',

  npmResolverRegistryNoVersions: 'No valid versions found for $0. The package may be unpublished.',

  ownerAdded: 'Added owner.',
  ownerAdding: 'Adding owner $0 to package $1',
  ownerAddingFailed: 'Could not add owner.',
  ownerAlready: 'This user is already an owner of this package.',
  ownerGetting: 'Getting owners for package $0',
  ownerGettingFailed: 'Could not get list of owners.',
  ownerNone: 'No owners.',
  ownerRemoveError: 'Could not remove owner.',
  ownerRemoved: 'Owner removed.',
  ownerRemoving: 'Removing owner $0 from package $1.',
  ownerUnknownUser: 'Could not find user $0.',
  ownerUserNotAnOwner: 'User $0 is not an owner of this package.',

  packWroteTarball: 'Wrote tarball to $0.',

  packageCompatibilityFoundIncompatible: 'Found incompatible module',
  packageCompatibilityIncompatibleEngine: 'The engine $0 is incompatible with this module. Expected version $1. Got $2',
  packageCompatibilityIncompatibleCpu: 'The CPU architecture $0 is incompatible with this module.',
  packageCompatibilityIncompatibleOs: 'The platform $0 is incompatible with this module.',
  packageCompatibilityInvalidEngine: 'The engine $0 appears to be invalid.',
  packageCompatibilityOptionalCompatibilityExcluded:
    '$0 is an optional dependency and failed compatibility check. Excluding it from installation.',

  packageFetcherMultiplePackagesSameDestination:
    'Pattern $0 is trying to unpack in the same destination $1 as pattern $2. This could result in non-deterministic behavior, skipping.',
  packageFetcherUnknownFetcher: 'Unknown fetcher for $0',

  packageInstallScriptsOptionalModuleCleanupFail: 'Could not cleanup build artifacts from failed install: $0',
  packageInstallScriptsOptionalModuleFail: 'This module is OPTIONAL, you can safely ignore this error',
  packageInstallScriptsOptionalModuleScriptFail: 'Error running install script for optional dependency: $0',

  packageLinkerIncorrectPeer: '$0 has incorrect peer dependency $1.',
  packageLinkerMissingBundledDependency:
    '$0 is missing a bundled dependency $1. This should be reported to the package maintainer.',
  packageLinkerSelectedPeer: 'Selecting $1 at level $2 as the peer dependency of $0.',
  packageLinkerUnmetPeer: '$0 has unmet peer dependency $1.',

  packageRequestFlatGlobalError:
    'The package $0@$1 requires a flat dependency graph. Add `"flat": true` to your package.json and try again.',
  packageRequestImplicitFileDeprecated:
    'Using the "file:" protocol implicitly is deprecated. Please either prepend the protocol or prepend the path $0 with `./`.',
  packageRequestInvalidPackageVersion: 'Cannot add $0: invalid package version $1.',
  packageRequestLockfileOutdated: 'Outdated lockfile. Please run `yarn install` and try again.',
  packageRequestMissingRequiredPackageKey: 'Package $0 does not have a $1.',
  packageRequestRequiredPackageNotFoundRegistry: 'Could not find package $0 required by $1 on the $2 registry.',
  packageRequestUnknownRegistryResolver: 'Unknown registry resolver $0',

  packageResolverIncorrectLockfileEntry: 'Lockfile has incorrect entry for $0. Ignoring it.',

  publishBumpingVersion: 'Bumping version',
  publishFail: 'Could not publish package: $0',
  publishInvalidAccess: 'Invalid argument for access, expected public or restricted.',
  publishPending: 'Publishing',
  publishPrivate: 'Package marked as private, not publishing.',
  publishSuccess: 'Published.',
  publishUnknownFolderOrTarball: 'Passed folder/tarball does not exist,',

  registryResolverInvalidFragment: 'Invalid fragment $0.',

  removeModuleNotInManifest: 'This module is not specified in a package.json file.',
  removeUninstallRegenerate: 'Regenerating lockfile and installing missing dependencies',
  removeUninstalledPackages: 'Uninstalled packages.',
  removeWorkspacesRemoveRootCheck:
    'Running this command will remove the dependency from the workspace root rather than the workspace itself, which might not be what you want - if you really meant it, make it explicit by running this command again with the -W flag (or --ignore-workspace-root-check).',

  requestManagerCantRequestOffline: 'Cannot make a request in offline mode ($0)',
  requestManagerError: 'Request $0 returned a $1',
  requestManagerFailed: 'Request failed $0',
  requestManagerInternalErrorRetrying: 'There appears to be trouble with the npm registry (returned $1). Retrying...',
  requestManagerNotSetupHar: 'RequestManager was not setup to capture HAR files',
  requestManagerOfflineRetrying: 'There appears to be trouble with your network connection. Retrying...',

  resolutionMapIncompatibleResolutionVersion: 'Resolution field $0 is incompatible with requested version $1',
  resolutionMapInvalidResolutionName: 'Resolution field $0 does not end with a valid package name and will be ignored',
  resolutionMapInvalidResolutionVersion: 'Resolution field $0 has an invalid version entry and may be ignored',

  runBinCommands: 'Commands available from binary scripts: ',
  runCommandNotSpecified: 'No command specified.',
  runCommandQuestion: 'Which command would you like to run?',
  runNoBinAvailable: 'There are no binary scripts available.',
  runNoScriptsAvailable: 'There are no scripts specified inside package.json.',
  runPossibleCommands: 'Project commands',

  tagCreatedTag: 'Created tag.',
  tagCreatedTagFail: 'Could not add tag.',
  tagCreatingTag: 'Creating tag $0 = $1',
  tagDeletedTag: 'Deleted tag.',
  tagDeletedTagFail: 'Could not delete tag.',
  tagDeletingTags: 'Deleting tag',
  tagGettingTags: 'Getting tags',
  tagRequiredVersionInRange: 'Required version in range.',

  tarballFetcherBadIntegrityAlgorithm:
    'Integrity checked failed for $0 (none of the specified algorithms are supported)',
  tarballFetcherErrorExtractingTarball: 'Extracting tar content of $1 failed, the file appears to be corrupt: $0',

  teamAddingUser: 'Adding user to team',
  teamCreating: 'Creating team',
  teamDeprecatedCommand: '$0 is deprecated. Please use $1.',
  teamListing: 'Listing teams',
  teamRemoving: 'Removing team',
  teamRemovingUser: 'Removing user from team',

  unplugDisabled: 'Packages can only be unplugged when Plug-n-Play is enabled.',

  upgradeBecauseOutdated: 'Considering upgrade of $0 to $1 because a newer version exists in the registry.',
  upgradeBecauseRequested: 'Considering upgrade of $0 to $1 because it was directly requested.',
  upgradeNotUnlocking: 'Not unlocking $0 in the lockfile because it is a new or direct dependency.',
  upgradeUnlocking: 'Unlocking $0 in the lockfile.',

  upgradeInteractiveUpToDate: 'All of your dependencies are up to date.',
  upgradeInteractiveUpdateInstalling: 'Installing $0...',

  verboseFileCopy: 'Copying $0 to $1.',
  verboseFileFolder: 'Creating directory $0.',
  verboseFileLink: 'Creating hardlink at $0 to $1.',
  verboseFilePhantomExtraneous:
    'File $0 would be marked as extraneous but has been removed as it is listed as a phantom file.',
  verboseFileRemoveExtraneous: 'Removing extraneous file $0.',
  verboseFileSkip: 'Skipping copying of file $0 as the file at $1 is the same size ($2) and mtime ($3).',
  verboseFileSkipArtifact: 'Skipping copying of $0 as the file is marked as a built artifact and subject to change.',
  verboseFileSkipSymlink: 'Skipping copying of $0 as the file at $1 is the same symlink ($2).',
  verboseFileSkipHardlink: 'Skipping copying of $0 as the file at $1 is the same hardlink ($2).',
  verboseFileSymlink: 'Creating symlink at $0 to $1.',

  verboseRequestFinish: 'Request $0 finished with status code $1.',
  verboseRequestStart: 'Performing $0 request to $1.',

  versionCurrentVersion: 'Current version',
  versionInvalidSemver: 'Invalid semver version',
  versionInvalidVersion: 'Invalid version supplied.',
  versionInvalidVersionArgument: 'Use the $0 flag to create a new version.',
  versionNewVersion: 'New version',
  versionNoVersionOnPublish: 'Proceeding with current version',

  whyCalculating: 'Calculating file sizes',
  whyDependedOn: '$0 depends on it',
  whyDependedOnSimple: 'This module exists because $0 depends on it.',
  whyDiskSizeTransitive: 'Disk size with transitive dependencies: $0',
  whyDiskSizeUnique: 'Disk size with unique dependencies: $0',
  whyDiskSizeWithout: 'Disk size without dependencies: $0',
  whyFinding: 'Finding dependency',
  whyHoistedFrom: 'Hoisted from $0',
  whyHoistedFromSimple: 'This module exists because it is hoisted from $0.',
  whyHoistedTo: 'Has been hoisted to $0',
  whyInitGraph: 'Initialising dependency graph',
  whyMatch: '\r=> Found $0',
  whyMissingDependency: 'Missing package name, folder or path to file to identify why a package has been installed',
  whyNotHoisted: 'in the nohoist list $0',
  whyNotHoistedSimple: 'This module exists here because it is in the nohoist list $0.',
  whyReasons: 'Reasons this module exists',
  whySharedDependencies: 'Number of shared dependencies: $0',
  whySpecified: 'Specified in $0',
  whySpecifiedSimple: 'This module exists because it is specified in $0.',
  whyStart: 'Why do we have the module $0?',
  whyUnknownMatch: 'We could not find a match!',
  whyWhoKnows: 'We do not know why this module exists',

  workspacesRootNotFound: 'Cannot find the root of your workspace - are you sure you are currently in a workspace?',
  workspaceMissingWorkspace: 'Missing workspace name.',
  workspaceMissingCommand: 'Missing command name.',
  workspaceUnknownWorkspace: 'Unknown workspace $0.',
};

export type LanguageKeys = $Keys<typeof messages>;
export default messages;
