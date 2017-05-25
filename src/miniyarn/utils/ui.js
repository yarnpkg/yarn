import inquirer       from 'inquirer';
import emoji          from 'node-emoji';
import ProgressBar    from 'progress';

import * as yarnUtils from 'miniyarn/utils/yarn';

let isSilentStack = [ false ];
let isProgressEnabledStack = [ true ];

export function isSilent() {

    return isSilentStack[0];

}

export function pushIsSilent(isSilentStatus) {

    if (isSilent() && !isSilentStatus)
        throw new Error(`Cannot disable the silent mode via a push - use pop instead`);

    isSilentStack.unshift(isSilentStatus);

}

export function popIsSilent() {

    return isSilentStack.shift();

}

export function isProgressEnabled() {

    return isProgressEnabledStack[0];

}

export function pushIsProgressEnabled(isProgressEnabledStatus) {

    if (!isProgressEnabled() && isProgressEnabledStatus)
        throw new Error(`Cannot enable the progress info via a push - use pop instead`);

    isProgressEnabledStack.unshift(isProgressEnabledStatus);

}

export function popIsProgressEnabled() {

    return isProgressEnabledStack.shift();

}

export function trackProgress({ enabled = true, bar = `:bar`, width = 50, total = 0 }, callback) {

    if (isProgressEnabled() && enabled) {

        let progressBar = new ProgressBar(bar, {
            width, total
        });

        let tick = () => {

            if (progressBar.curr + 1 >= progressBar.total)
                progressBar.fmt += ` (:elapseds)`;

            progressBar.tick();

        };

        let add = n => {

            progressBar.total += n;
            progressBar.render();

        };

        progressBar.render();

        return Promise.resolve().then(() => {

            return callback({ tick, add });

        }).then(result => {

            if (!progressBar.complete)
                progressBar.terminate();

            return result;

        }, error => {

            if (!progressBar.complete)
                progressBar.terminate();

            throw error;

        });

    } else {

        let tick = () => {};
        let add = () => {};

        return Promise.resolve().then(() => {
            return callback({ tick, add });
        });

    }

}

export async function askOne({ message = `Please select one:`, choices = [], ... options } = {}) {

    await inquirer.prompt({

        name: `value`,
        type: `list`,

        message,
        choices,

        ... options,

    });

}

export function reportError(error) {

    process.stderr.write(`Error: ${error.message}\n`);

    return 1;

}

export function reportPackageErrors(errors) {

    if (errors.size === 0)
        throw new Error(`Failed to execute 'reportPackageErrors': At least one error must be reported`);

    for (let [ packageRange, error ] of errors.sortBy((error, packageRange) => packageRange.name))
        process.stderr.write(`Error: ${yarnUtils.getRangeIdentifier(packageRange)}: ${error.stack}\n`);

    process.stderr.write(`${emoji.get(`x`)}  Something failed that cannot be recovered\n`);

    return 1;

}
