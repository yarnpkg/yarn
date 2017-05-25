export async function delay(ms) {

    return new Promise((resolve, reject) => {

        setTimeout(() => {
            resolve();
        }, ms);

    });

}
export async function timeout(ms) {

    return new Promise((resolve, reject) => {

        setTimeout(() => {
            reject(new Error(`Execution timed out`));
        }, ms);

    });

}
