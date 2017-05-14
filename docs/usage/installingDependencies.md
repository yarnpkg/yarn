#Installing Dependencies

If you have just checked out a package from [version control](versionControl.md), you will need to install those dependencies.

>If you are adding dependencies for your project, then those dependencies are automatically installed during that process.

##Installing Dependencies

`yarn install` is used to install all dependencies for a project. The dependencies are retrieved from your project’s `package.json` file, and stored in the `yarn.lock` file.

When developing a package, installing dependencies is most commonly done after:

1. You have just checked out code for a project that is creating a package.
2. Another developer on the project has added a new dependency that you need to pick up.

##Installing Options

There are many options for installing dependencies, including:

    Installing all dependencies: yarn or yarn install
    Installing one and only one version of a package: yarn install --flat
    Forcing a re-download of all packages: yarn install --force
    Installing only production dependencies: yarn install --production

See the [full list of flags](https://yarnpkg.com/en/docs/cli/install) you can pass to `yarn install`.
