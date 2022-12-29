const { roundTwo } = require('../util');

test('roundTwo', () => {
  expect(roundTwo(1.234)).toBe('1.23');
  expect(roundTwo(1.235)).toBe('1.24');
  expect(roundTwo(-1.234)).toBe('-1.23');
  expect(roundTwo(-1.235)).toBe('-1.24');
  expect(roundTwo(0)).toBe('0.00');
  expect(roundTwo(-0)).toBe('0.00');
  expect(roundTwo(1.2345678)).toBe('1.23');
  expect(roundTwo(1.2345679)).toBe('1.23');
  expect(roundTwo(-1.2345678)).toBe('-1.23');
  expect(roundTwo(-1.2345679)).toBe('-1.23');
  expect(roundTwo(1)).toBe('1.00');
  expect(roundTwo(-1)).toBe('-1.00');
  expect(roundTwo(1.2)).toBe('1.20');
  expect(roundTwo(-1.2)).toBe('-1.20');
});
