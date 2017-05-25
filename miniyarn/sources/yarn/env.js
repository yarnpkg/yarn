import { Environment } from 'miniyarn/models/Environment';

export let env = new Environment({

    CACHE_PATH: `/tmp/miniyarn/cache`,

    MIRROR_PATH: `/tmp/miniyarn/mirror`,

});
