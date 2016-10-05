/* @flow */
 /* eslint max-len: 0 */

let messages = {
  upToDate: 'Already up-to-date.',
  folderInSync: 'Folder in sync.',
  nothingToInstall: 'Nothing to install.',
  resolvingPackages: 'Resolving packages',
  fetchingPackages: 'Fetching packages',
  linkingDependencies: 'Linking dependencies',
  rebuildingPackages: 'Rebuilding all packages',
  buildingFreshPackages: 'Building fresh packages',
  cleaningModules: 'Cleaning modules',
  bumpingVersion: 'Bumping version',
  savingHar: 'Saving HAR file: $0',
  answer: 'Answer?',
  usage: 'Usage',
  installCommandRenamed: '`install` has been replaced with `add` to add new dependencies.',
  waitingInstance: 'Waiting until the other yarn instance finish',
  offlineRetrying: 'There appears to be trouble with your network connection. Retrying...',
  clearedCache: 'Cleared cache.',
  packWroteTarball: 'Wrote tarball to $0.',

  manifestPotentialType: 'Potential typo $0, did you mean $1?',
  manifestBuiltinModule: '$0 is also the name of a node core module',
  manifestNameDot: "Name can't start with a dot",
  manifestNameIllegalChars: 'Name contains illegal characters',
  manifestNameBlacklisted: 'Name is blacklisted',
  manifestLicenseInvalid: 'License should be a valid SPDX license expression',
  manifestLicenseNone: 'No license field',
  manifestStringExpected: '$0 is not a string',
  manifestDependencyBuiltin: 'Dependency $0 listed in $1 is the name of a built-in module',
  manifestDependencyCollision: '$0 has dependency $1 with range $2 that collides with a dependency in $3 of the same name with version $4',

  couldntFindMatch: "Couldn't find match for $0 in $1 for $2.",
  couldntFindPackageInCache: "Couldn't find any versions for $0 that matches $1 in our cache. Possible versions: $2",
  moduleNotInManifest: "This module isn't specified in a manifest.",
  tooManyArguments: 'Too many arguments, maximum of $0.',
  tooFewArguments: 'Not enoguh arguments, expected at least $0.',
  unknownFolderOrTarball: "Passed folder/tarball doesn't exist,",
  invalidPackageName: 'Invalid package name.',
  unknownPackageName: "Couldn't find package name.",
  invalidVersionArgument: 'Use the $0 flag to create a new version.',
  invalidVersion: 'Invalid version supplied.',
  requiredVersionInRange: 'Required version in range.',
  packageNotFoundRegistry: "Couldn't find package $0 on the $1 registry.",
  invalidAccess: 'Invalid argument for access, expected public or restricted.',
  unknownPackagePattern: "Couldn't find package $0.",
  doesntExist: "$0 doesn't exist.",
  missingRequiredPackageKey: `Package $0 doesn't have a $1.`,
  invalidGistFragment: 'Invalid gist fragment $0.',
  invalidHostedGitFragment: 'Invalid hosted git fragment $0.',
  couldntFindManifestIn: "Couldn't find manifest in $0.",
  invalidFragment: 'Invalid fragment $0.',
  shrinkwrapWarning: 'npm-shrinkwrap.json found. This will not be updated or respected. See [TODO] for more information.',

  commandNotSpecified: 'No command specified.',
  binCommands: 'Commands available from binary scripts: ',
  possibleCommands: 'Project commands',
  commandQuestion: 'Which command would you like to run?',
  commandFailed: 'Command failed with exit code $0.',

  foundIncompatible: 'Found incompatible module',
  incompatibleEngine: `The engine $0 is incompatible with this module. Expected version $1.`,
  incompatibleCPU: `The CPU architecture $0 is incompatible with this module.`,
  incompatibleOS: 'The platform $0 is incompatible with this module.',
  invalidEngine: 'The engine $0 appears to be invalid.',

  selfUpdateReleased: 'Replaced current release with $0.',
  selfUpdateDownloading: `Downloading asset $0 from release $1`,

  optionalCompatibilityExcluded: '$0 is an optional dependency and failed compatibility check. Excluding it from installation.',
  optionalModuleFail: 'This module is OPTIONAL, you can safely ignore this error',
  optionalModuleScriptFail: 'Error running install script for optional dependency: $0',

  unmetPeer: 'Unmet peer dependency $0.',
  incorrectPeer: 'Incorrect peer dependency $0.',

  savedNewDependency: 'Saved 1 new dependency',
  savedNewDependencies: 'Saved $0 new dependencies.',

  foundWarnings: 'Found $0 warnings.',
  foundErrors: 'Found $0 errors.',

  savedLockfile: 'Saved lockfile.',
  noRequiredLockfile: 'No lockfile in this directory. Run `yarn install` to generate one.',
  noLockfileFound: 'No lockfile found.',

  invalidSemver: 'Invalid semver version',
  newVersion: 'New version',
  currentVersion: 'Current version',

  manualVersionResolution: 'Unable to find a suitable version for $0, please choose one by typing one of the numbers below:',
  manualVersionResolutionOption: '$0 which resolved to $1',

  createdTag: 'Created tag.',
  createdTagFail: "Couldn't add tag.",
  deletedTag: 'Deleted tag.',
  deletedTagFail: "Couldn't delete tag.",
  gettingTags: 'Getting tags',
  deletingTags: 'Deleting tag',
  creatingTag: 'Creating tag $0 = $1',

  alreadyAnOwner: 'This user is already an owner of this package/',
  addedOwner: 'Added owner.',
  addedOwnerFail: "Couldn't add owner.",
  addingOwner: 'Adding owner $0 to package $1',

  whyStart: 'Why do we have the module $0?',
  whyFinding: 'Finding dependency',
  whyUnknownMatch: "We couldn't find a match!",
  whyInitGraph: 'Initialising dependency graph',
  whyWhoKnows: "We don't know why this module exists",
  whyDiskSizeWithout: 'Disk size without dependencies: $0',
  whyDiskSizeUnique: 'Disk size with unique dependencies: $0',
  whyDiskSizeTransitive: 'Disk size with transitive dependencies: $0',
  whySharedDependencies: 'Amount of shared dependencies: $0',
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
  cleanSavedSize: 'Saved $0.',

  npmUsername: 'npm username',
  npmPassword: 'npm password',
  npmEmail: 'npm email',

  loggingIn: 'Logging in',
  loggedIn: 'Logged in.',
  notRevokingEnvToken: 'Not revoking login token, specified via environment variable.',
  noTokenToRevoke: 'No login token to revoke.',
  revokingToken: 'Revoking token',
  revokedToken: 'Revoked login token.',

  loginAsPublic: 'Logging in as public',
  incorrectCredentials: 'Incorrect username or password.',
  clearedCredentials: 'Cleared login credentials.',

  publishFail: "Couldn't publish package.",
  publishPrivate: 'Package marked as private, not publishing.',
  publishNoName: `Package doesn't have a name.`,
  published: 'Published.',
  publishing: 'Publishing',

  infoFail: 'Received invalid response from npm.',
};

export type LanguageKeys = $Keys<typeof messages>;
export default messages;
