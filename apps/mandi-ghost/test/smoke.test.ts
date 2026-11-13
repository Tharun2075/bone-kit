import { it, expect } from 'vitest';
import { createCodec, SMS_BYTES } from '@bone-kit/skeleton';

it('a mandi price row fits one SMS', () => {
  const codec = createCodec([
    { name: 'crop', type: 'str' },
    { name: 'market', type: 'str' },
    { name: 'pricePaise', type: 'int' },
    { name: 'at', type: 'int' },
  ]);
  const row = { crop: 'tomato', market: 'kurnool', pricePaise: 125000, at: 1794560000000 };
  const sms = codec.encode(row);
  expect(sms.length).toBeLessThanOrEqual(SMS_BYTES);
  expect(codec.decode(sms)).toEqual(row);
});
