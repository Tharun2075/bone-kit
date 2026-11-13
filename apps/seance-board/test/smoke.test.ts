import { it, expect } from 'vitest';
import { createDoc, merge } from '@bone-kit/skeleton';

it('two offline boards merge into one', () => {
  const a = createDoc().doc;
  const b = createDoc().doc;
  a.getArray<string>('notes').push(['from a']);
  b.getArray<string>('notes').push(['from b']);
  const ab = merge(a, b).getArray<string>('notes').toJSON();
  expect(ab).toHaveLength(2);
  expect(merge(b, a).getArray<string>('notes').toJSON()).toEqual(ab);
});
