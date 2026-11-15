import { PEOPLE } from './roles.js';
import { DUTIES } from './mission.js';

// First screen: pick who you are. shortcut: no passwords (local, one shared device); add real sign-in with a habitat server.
export default function Login({ onPick }) {
  const group = (title, list) => (
    <section className="login-group" aria-label={title}>
      <h2 className="login-h">{title}</h2>
      <ul className="login-list">
        {list.map((p) => (
          <li key={p.id}>
            <button className="login-card" onClick={() => onPick(p.id)}>
              <span className="login-role">{p.role}</span>
              {p.name !== p.role && <span className="login-name">{p.name}</span>}
              <span className="login-duty">{DUTIES[p.id]}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <div className="start login">
      <header className="start-nav"><span className="wordmark">A.R.E.S.<span>FIELD MAP</span></span></header>
      <main className="login-main">
        <p className="lede">A.R.E.S. plans a seven-sol crew mission at a crater near Chryse Planitia, Mars, on NASA orbital data: where the rover can drive, where the crew can walk back from, and when they must turn back.</p>
        <h1 className="display-s">Who is signing in?</h1>
        <p className="lede">Pick your seat. You will see the whole crew and your own tasks.</p>
        {group('Crew', PEOPLE.filter((p) => p.human && !p.remote))}
        {group('Agents', PEOPLE.filter((p) => p.remote || !p.human))}
        <p className="note">No password: this is a demo on one shared device.</p>
      </main>
    </div>
  );
}
