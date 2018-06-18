import test from 'ava';

const fn = async () => Promise.resolve('foo');

test('foo title', async (t) => {
  const result = await fn();
  t.is(result, 'foo');
});
