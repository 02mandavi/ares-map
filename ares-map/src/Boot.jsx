import { useEffect, useState } from 'react';
import { marsClock } from './Start.jsx';

// First screen while the site data arrives. Plain words; the real CTX photo of the crater shows as soon as it is here.
const FILES = ['site', 'ctx', 'themis_day', 'themis_night'];

export default function Boot({ done, ctxSrc }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const h = marsClock(now, 319.77).lmst, n = FILES.filter((k) => done[k]).length;
  const clock = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(h * 60 % 60)).padStart(2, '0')}`;
  return (
    <div className="boot" aria-busy="true">
      <div className="boot-copy">
        <p className="wordmark">A.R.E.S.</p>
        <h1 className="boot-h">Walk on Mars. Come home safe.</h1>
        <p className="boot-sub">We mapped a real crater on Mars from space, so astronauts know where to go and when to turn back.</p>
        <div className="boot-bar" role="progressbar" aria-label="Loading the Mars map" aria-valuemin={0} aria-valuemax={FILES.length} aria-valuenow={n}><i style={{ transform: `scaleX(${n / FILES.length})` }} /></div>
        <p className="small muted">Loading real NASA pictures of the crater: {n} of {FILES.length}</p>
      </div>
      <figure className="boot-fig">
        {ctxSrc ? <img src={ctxSrc} alt="Photo of the crater taken from orbit by NASA's Mars Reconnaissance Orbiter" /> : <div className="boot-wait" />}
        <figcaption className="small muted">{ctxSrc ? `This crater is real. It is ${clock} there right now.` : 'The photo is on its way from Mars orbit.'}</figcaption>
      </figure>
    </div>
  );
}
