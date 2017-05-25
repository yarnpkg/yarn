# Design document

## Glossary

- **Reference:** A reference is a string that allows fetchers to know where a package data should be pulled from. A common theme is that modular components such as resolvers, fetchers, and linkers, are expected to be able to know if they support a given reference or not. For example, a semver string will be handled by the classic resolution algorithm, whereas a git url will be handled by a different one.

- **Pinned reference:** A pinned reference is a reference that is meant to identify a single version of a package. For example, "1.0.0" is a pinned reference, but "^1.0.0" is not (even if there's a single version that match this range).

- **Volatile reference:** A volatile reference is a reference whose content cannot be trusted to stay the same. For example, a git repository. Note that a volatile reference will always be a pinned reference, but the opposite is not true.

- **Package range:** A package range is a small object that contains the minimal amount of data required for a resolver to work, ie. name + reference. Unlike package locators, package range references are not required to be pinned references, which usually makes them unsuitable keys.

- **Package locator:** A package locator is very much like a package range, except that it has the extra requirement that its reference **must** also be a pinned reference. It makes package locators much better keys than package ranges, since they will only ever target a single package.

- **Package resolution:** A package resolution is a locator with an extra field, `dependencies`, that contains package ranges. They differ from package info in that they don't contain anything else yet. No description, no license, no contributors, nothing!

- **Package node:**  A package node is a package resolution who made it. Its `dependencies` field now contain other package node instances, instead of simply package ranges. It's now a recursive data structure, a real tree.

- **Package tree:** A package tree is the name given to the root node of a tree composed of multiple package node.

- **Package info:** A package info is a large object that can be see as an in-memory mapping of a `package.json` file. It contains everything you can find there. Note that package info objects have a schema, so the data they contain might not be exactly what you can find in these package.json files, in the event they have been badly generated or became corrupted.

- **Resolver:** Resolvers are objects that have the ability to convert package ranges into package resolutions. Note that because package resolutions are not recursive data structures, resolvers by themselves cannot construct a package tree - you will need to implement an algorithm on top of them in order to do this.

- **Fetcher:** Fetchers are objects that have the ability to convert package locators into package info. Unless instructed otherwise, they will also fetch the full package data, including its tarball.

- **Linker:** Linkers are tasked with inserting the dependencies data inside their dependents. It will usually involve copying the package data into the `node_modules` folder, but not only. For example, a linker could use hardlinks instead of an actual copy (we might note however that this is a bad example - such a feature would probably be better implemented as a linker option rather than a dedicated linker, since it's an implementation detail with no semantic meaning). Note that, contrary to how resolvers and fetchers work, linkers are applied recursively. You should not call a linker on a sub-dependency.

## Catch-22

- In order to work, a resolver must have a reference to a fetcher. This is because some resolvers actually need to fetch the whole package data in order to extract the relevant informations (for example, in order to obtain the package.json file from a git repository, we have to fetch the whole repository). Of course this is not required for every resolver, since some of them offer dedicated endpoints (such as the Yarn registry resolver), but because you're not supposed to make any assumption regarding the resolver implementation, you should still pass the fetcher as parameter when calling the `resolve` function.
