// People and permissions. shortcut: profiles are picked, not authenticated (no passwords, local only); add real logins with a habitat server.
export const PEOPLE = [
  { id: 'c1', name: 'Crew 1', role: 'Commander', human: true },
  { id: 'c2', name: 'Crew 2', role: 'EVA lead', human: true },
  { id: 'c3', name: 'Crew 3', role: 'Science', human: true },
  { id: 'c4', name: 'Crew 4', role: 'Medic', human: true },
  { id: 'mc', name: 'Mission Control', role: 'Mission Control', human: true, remote: true },
  { id: 'auto', name: 'Autonomous', role: 'A.R.E.S. agent', human: false },
];
export const person = (id) => PEOPLE.find((p) => p.id === id) ?? PEOPLE[0];

// What each kind of account may do. The autonomous account reads, proposes and simulates; a named human approves.
export function can(p, action, target) {
  switch (action) {
    case 'approve': case 'complete-objective': case 'confirm-crack': case 'clear-descent': return p.human && !p.remote; // decisions stay with the crew on site (Earth is minutes away)
    case 'edit-vitals': return p.human && !p.remote;
    case 'set-rover-mode': return p.human; // crew or Mission Control override the autonomous pick
    case 'see-health': return p.id === target || p.role === 'Medic';
    case 'propose': case 'simulate': case 'trace': return true;
    default: return p.human;
  }
}

if (import.meta.env?.DEV) {
  console.assert(!can(person('auto'), 'approve') && can(person('c1'), 'approve'), 'autonomous cannot approve');
  console.assert(can(person('mc'), 'set-rover-mode') && !can(person('auto'), 'set-rover-mode'), 'mode override is for people');
  console.assert(can(person('c4'), 'see-health', 'c2') && !can(person('c3'), 'see-health', 'c2'), 'health is private to self and medic');
}
