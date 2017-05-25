import Immutable               from 'immutable';

import { traversePackageTree } from 'miniyarn/algorithms/traversePackageTree';

export async function getPackageTreeLocators(packageTree, { includeRoot = true } = {}) {

    let uniqueSet = new Immutable.Set().asMutable();

    await traversePackageTree(packageTree, async (packageNode) => {
        uniqueSet.add(packageNode.locator);
    }, { traverseRoot: includeRoot });

    return uniqueSet.asImmutable();

}
