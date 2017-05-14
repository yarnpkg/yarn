#Creating a new project

It doesn’t matter if you have an existing repository/directory of code, or if you are starting a completely new project, adding Yarn works the same way every time.

In your terminal/console in the directory that you want to add Yarn (which should almost always be the root of your project), run the following command:

>yarn init

This will open up an interactive form for creating a new yarn project with the following questions:

```
name (your-project):
version (1.0.0):
description:
entry point (index.js):
git repository:
author:
license (MIT):
```

You can type answers for each of these or you can just hit enter/return to use the default or leave it blank.

#####package.json

Now you should have a `package.json` that looks similar to this:

```
{
  "name": "my-new-project",
  "version": "1.0.0",
  "description": "My New Project description.",
  "main": "index.js",
  "repository": {
    "url": "https://example.com/your-username/my-new-project",
    "type": "git"
  },
  "author": "Your Name <you@example.com>",
  "license": "MIT"
}
```

When you run `yarn init`, all it is doing is creating this file, nothing happens in the background. You can feel free to edit this file as much as you want.

Your `package.json` is used to store info about your project. This includes the name of your project, the maintainers, where the source code lives, but most importantly what dependencies are needed to be installed for the project.
