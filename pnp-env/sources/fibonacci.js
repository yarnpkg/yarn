export function fibonacci(n) {

    if (n === -Infinity)
        return -Infinity;

    if (n === +Infinity)
        return +Infinity;

    if (n === 0)
        return 0;

    let A = (1 + Math.sqrt(5)) / 2;
    let B = (1 - Math.sqrt(5)) / 2;

    let res = Math.ceil((Math.pow(A, n) - Math.pow(B, n)) / Math.sqrt(5));

    if (res <= 0)
        res -= 1;

    return res;

}
