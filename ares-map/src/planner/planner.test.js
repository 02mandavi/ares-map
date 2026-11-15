import { describe, it, expect } from 'vitest';
import { feasibility } from './feasible.js';

describe('review fixes 2026-11-15', () => {
  it('a one-site day with the brief drive time still fails when the rover has no route', () => {
    const legs = [{ hours: 0.5, blocked: true }, { hours: 0.5 }]; // App.jsx dayLegs keeps blocked
    const f = feasibility({ legs, totalH: 3, evaH: 7, reserveH: 0.25, stops: [{ id: 'S1' }], inWalkBack: () => true });
    expect(f.feasible).toBe(false);
    expect(f.reasons[0]).toMatch(/No route found from HAB to S1/);
  });
});
