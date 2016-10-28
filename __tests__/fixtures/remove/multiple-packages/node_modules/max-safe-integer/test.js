import test from 'ava';
import x from './';

test(t => {
	t.is(typeof x, 'number');
	t.is(x + 1, x + 2);
	t.not(x - 1, x - 2);
});
