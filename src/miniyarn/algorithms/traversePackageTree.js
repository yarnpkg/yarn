import Immutable from 'immutable';

export async function traversePackageTree(packageTree, callback, { traverseRoot = true, initial = {} } = {}) {

    let queue = [ [ packageTree, new Immutable.List(), initial ] ];

    while (queue.length > 0) {

        let [ packageNode, packagePath, value ] = queue.shift();

        if (packageNode !== packageTree || traverseRoot) {
            value = await callback(packageNode, packagePath, value);
            packagePath = packagePath.push(packageNode);
        }

        for (let dependency of packageNode.dependencies.valueSeq().reverse()) {
            queue.unshift([ dependency, packagePath, value ]);
        }

    }

}
