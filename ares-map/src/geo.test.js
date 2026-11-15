import { describe, it, expect } from 'vitest';
import { blur } from './geo.js';

describe('display blur', () => {
  it('keeps a flat field flat, softens a spike, and skips no-data cells', () => {
    const flat = blur(new Float32Array(9).fill(-4000), 3, 3);
    expect([...flat].every((v) => Math.abs(v + 4000) < 1e-3)).toBe(true);
    const spike = new Float32Array(9); spike[4] = 160;
    expect(blur(spike, 3, 3)[4]).toBe(40); // centre weight 4 of 16
    const hole = Float32Array.from([1, 1, 1, 1, NaN, 1, 1, 1, 1]);
    expect(blur(hole, 3, 3)[4]).toBe(1);
  });
});
