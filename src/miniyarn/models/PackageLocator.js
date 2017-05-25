import Immutable      from 'immutable';

import * as yarnUtils from 'miniyarn/utils/yarn';

export class PackageLocator extends Immutable.Record({

    name: undefined,

    reference: undefined,

}) {

}
