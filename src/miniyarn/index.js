import Fs from 'fs';
import gracefulFs from 'graceful-fs';

import {cli} from 'miniyarn/cli';

// Prevents various crashes triggered because of the high number of I/O operations
gracefulFs.gracefulify(Fs);

// Make sure that we're notified of any promise that would fail without being catched - shouldn't happen
process.on(`unhandledRejection`, err => console.error(`Unhandled promise rejection:`, err.stack));

// Finally run the command line, then exits
cli.runExit(process.argv0, process.argv.slice(2));
