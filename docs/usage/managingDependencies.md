# Managing Dependencies



When you want to add, upgrade, or remove dependencies there are a couple of different commands you need to know.

Each command will automatically update your `package.json` and `yarn.lock` files.

##Adding a dependency

If you want to use another package, you first need to add it as a dependency. In order to do that you should run:

>yarn add [package]

This will automatically add the [package] to your dependencies in your `package.json`. It will also update your `yarn.lock` to reflect the change.

```
  {
    "name": "my-package",
    "dependencies": {
+        "package-1": "^1.0.0"
    }
  }
```

You can also add other types of dependencies using flags:

```
    yarn add --dev to add to devDependencies
    yarn add --peer to add to peerDependencies
    yarn add --optional to add to optionalDependencies
```

You can specify which version of a package you want to install by specifying either a dependency version or a tag.

>yarn add [package]@[version]
>
>yarn add [package]@[tag]

The `[version]` or `[tag]` will be what gets added to your `package.json` and then resolved against when installing the dependency.

For example:

>yarn add package-1@1.2.3
>
>yarn add package-2@^1.0.0
>
>yarn add package-3@beta

```
{
  "dependencies": {
    "package-1": "1.2.3",
    "package-2": "^1.0.0",
    "package-3": "beta"
  }
}
```

##Upgrading a dependency

>yarn upgrade [package]
>
>yarn upgrade [package]@[version]
>
>yarn upgrade [package]@[dist-tag]

This will upgrade your `package.json` and your `yarn.lock` file.

```
  {
    "name": "my-package",
    "dependencies": {
-     "package-1": "^1.0.0"
+     "package-1": "^2.0.0"
    }
  }
```

##Removing a dependency

>yarn remove [package]

This will update your package.json and your yarn.lock file.
