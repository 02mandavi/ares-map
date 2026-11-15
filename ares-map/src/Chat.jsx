import { useEffect, useRef, useState } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import { feasibility } from './planner/feasible.js';
import { EVA_H, DUTIES, planTimeline, fmtClock, fmtH, bearing, tasksFor } from './mission.js';
import { distKm } from './geo.js';
import { PEOPLE, can } from './roles.js';

// A.R.E.S. companion: Claude with the map's live state and two calculators.
// shortcut: the user's own API key lives in this browser and calls the API directly; move it behind a habitat server before real use.
const KEY = 'ares.apiKey';
const MODEL = 'claude-haiku-5-5'; // cheapest current Claude; short companion answers don't need Opus
const GEMINI = 'gemini-flash-latest'; // the model in AI Studio's own "Get code" sample, which works with its AQ. keys
// "ollama" (or "ollama:<model>") in the key box means the Ollama server on this computer; no key leaves the machine.
const isOllama = (k) => /^ollama(:|$)/i.test(k), ollamaModel = (k) => k.split(':').slice(1).join(':') || 'gemma3:4b';
const OLLAMA = 'http://localhost:11434';
const isGemini = (k) => !k.startsWith('sk-ant-') && !isOllama(k); // Anthropic keys start with sk-ant-; anything else goes to Google (AI Studio keys come as AIza... or AQ....)

// One Gemini generateContent call. The key goes in a header, never in the URL.
let quick = true; // ask Gemini to skip long thinking; dropped for good if the model behind the alias refuses the setting
async function gemini(key, system, contents, tools = [{ functionDeclarations: TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.input_schema })) }]) {
  const call = () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, tools, ...(quick ? { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } } : {}) }),
  });
  let res = await call(), j = await res.json().catch(() => ({}));
  if (res.status === 400 && quick && /thinking/i.test(j.error?.message ?? '')) { quick = false; res = await call(); j = await res.json().catch(() => ({})); }
  if (!res.ok) throw Object.assign(new Error(`${res.status} ${j.error?.status ?? ''} ${j.error?.message ?? res.statusText}`.trim()), { status: res.status });
  return j;
}
// Web search runs as its own call: Gemini's google_search and Claude's web_search are server tools on the provider's side.
async function searchWeb(key, query) {
  const ask = 'Search the web and answer in two to four sentences. Name your sources.';
  if (isGemini(key)) {
    const j = await gemini(key, ask, [{ role: 'user', parts: [{ text: query }] }], [{ google_search: {} }]), c = j.candidates?.[0];
    return { answer: (c?.content?.parts ?? []).map((x) => x.text ?? '').join('').trim(), sources: (c?.groundingMetadata?.groundingChunks ?? []).map((g) => g.web?.title ?? g.web?.uri).filter(Boolean).slice(0, 5) };
  }
  const r = await new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }).messages.create({ model: MODEL, max_tokens: 2000, system: ask, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }], messages: [{ role: 'user', content: query }] });
  return { answer: r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim() };
}
const WAKE = /\b(hey|hi|hello|okay|ok)[\s,]+(aries|ares|a\.r\.e\.s\.?|ari?es|aris|arise|aires|airies|eris|iris|harris|harry's|arias|a r e s)\b[\s,.!?]*/i; // speech-to-text spells the name many ways

const TOOLS = [
  { name: 'evaluate_route', description: 'Plan a drive from the habitat through the given stops in order and back. Returns feasible (true/false) with the reasons, the time, distance and whether it fits before the turn-back reserve. Use it for any "what if we go to X then Y" question.',
    input_schema: { type: 'object', properties: { stops: { type: 'array', items: { type: 'string' }, description: 'Station ids in visit order, e.g. ["S3","S1"]' } }, required: ['stops'] } },
  { name: 'distance_between', description: 'Rover drive time and km along the planned path, plus the straight-line km and compass bearing, between two places: a station id, "HAB" for the habitat, or "ROVER" for where the rover is now.',
    input_schema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] } },
  { name: 'web_search', description: 'Search the public web, for facts not in the mission data: real Mars science, NASA missions, definitions. Never for crew or health data.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
];

// Everything the companion knows, as plain data. Health only for people the signed-in user may see.
function snapshot(c) {
  const { user, plan, stations, routeStops, timeline, sim, pos, turnBackInH, homeKm, roverMode, monitor, limits, storm, objectives, accessOf } = c;
  const here = accessOf(pos.xz), who = c.signedIn ? user : null;
  return {
    signed_in_as: who ? { role: who.role, duty: DUTIES[who.id], my_tasks: tasksFor(who.id, routeStops).map((x) => `${x.stop.id}: ${x.task}`) } : 'nobody yet: the login screen is open',
    clock: { eva_time: fmtClock(plan.start, sim.t), elapsed_h: +sim.t.toFixed(2), eva_limit_h: EVA_H, reserve_h: plan.reserveH, turn_back_in: turnBackInH < 0 ? `overdue by ${fmtH(-turnBackInH)}` : fmtH(turnBackInH), km_to_home: +homeKm.toFixed(1) },
    rover: { mode: roverMode.mode, mode_reason: roverMode.why ?? roverMode.by, battery_pct: monitor.rover.r.batt, km_driven: monitor.rover.km, aboard: monitor.rover.aboard, drill: monitor.rover.drill, dust_storm: storm },
    ground_here: { terrain: here.terrain.name, slope_deg: +here.slope.toFixed(0), radio_to_base: here.radio ? 'line of sight' : 'shadow, relay needed' },
    limits: { walk_slope_deg: limits.walk, rover_slope_deg: limits.rover, speed_kmh: plan.speed },
    route: { stops: routeStops.map((s) => s.id), feasible: c.feas.feasible, reasons: c.feas.reasons, total_h: +timeline.totalH.toFixed(2), back_if_ground_bad: c.ground ? fmtClock(plan.start, c.ground.badH) : null, energy_kwh: c.ground ? +c.ground.kwh.toFixed(1) : null, km: +timeline.km.toFixed(1),
      legs: timeline.legs.map((l) => (l.kind === 'drive' ? `drive to ${l.stop?.id ?? 'HAB'} ${l.km.toFixed(1)} km, ${fmtClock(plan.start, l.t0)}-${fmtClock(plan.start, l.t1)}` : `work at ${l.stop.id}, ${fmtClock(plan.start, l.t0)}-${fmtClock(plan.start, l.t1)}`)) },
    stations: stations.map((s) => ({ id: s.id, name: s.name, km_from_hab: +s.distKm.toFixed(1), goal: s.goal, question: s.question, tasks: (s.tasks ?? []).map((t, i) => `${t} (${PEOPLE.find((p) => p.id === s.who?.[i])?.role ?? 'unassigned'})`), recommend: s.rec ? `${s.rec.action}: ${s.rec.why}` : undefined, unknowns: s.negative, done: !!objectives[s.id]?.done })),
    crew: monitor.crew.map((m) => ({ role: PEOPLE.find((p) => p.id === m.id).role, where: m.where, health: who && can(who, 'see-health', m.id) ? m.r : 'private to that person and the medic' })),
    habitat: monitor.habitat.r,
  };
}

// Small local models can't use tools or do clock arithmetic reliably, so the key answers are worked out here in plain sentences.
function facts(c) {
  const { plan, stations, routeStops, timeline, sim, turnBackInH, homeKm } = c, limit = EVA_H - plan.reserveH;
  return [
    `The EVA started at ${plan.start}. It is now ${fmtClock(plan.start, sim.t)} (${fmtH(sim.t)} into the EVA).`,
    `Today's route: habitat, ${routeStops.map((s) => s.id).join(', ')}, habitat. ${timeline.km.toFixed(1)} km driving, ${fmtH(timeline.totalH)} in total.`,
    `The plan gets the crew back to base at ${fmtClock(plan.start, timeline.totalH)}.`,
    `Latest safe time to turn back is ${fmtClock(plan.start, limit)} (the ${EVA_H} h EVA limit minus ${plan.reserveH} h reserve). ${turnBackInH < 0 ? `That is overdue by ${fmtH(-turnBackInH)}.` : `That is ${fmtH(turnBackInH)} from now.`}`,
    timeline.totalH > limit ? `Warning: the plan runs ${fmtH(timeline.totalH - limit)} past the turn-back time.` : `The plan fits, with ${fmtH(limit - timeline.totalH)} to spare.`,
    `The rover is ${homeKm.toFixed(1)} km from base now.`,
    ...stations.map((s) => `${s.id} (${s.name}) is ${s.distKm.toFixed(1)} km straight-line from the habitat.`),
  ].join('\n');
}

function runTool(name, input, c) {
  const { stations, habXZ, plan, pos, planner } = c;
  const at = (id) => (id === 'HAB' ? habXZ : id === 'ROVER' ? pos.xz : stations.find((s) => s.id === String(id).toUpperCase())?.xz);
  if (name === 'distance_between') {
    const a = at(input.from), b = at(input.to);
    if (!a || !b) return { error: `unknown place; use HAB, ROVER or one of ${stations.map((s) => s.id).join(', ')}` };
    const l = planner.leg('rover', a, b);
    return { km_straight: +distKm(a, b).toFixed(2), km_path: l.blocked ? null : +l.km.toFixed(2), drive_h: l.blocked ? null : +l.hours.toFixed(2), no_route_found: l.blocked, bearing_deg: Math.round(bearing(a, b)) };
  }
  if (name === 'evaluate_route') {
    const stops = (Array.isArray(input.stops) ? input.stops : []).map((id) => stations.find((s) => s.id === String(id).toUpperCase()));
    if (!stops.length || stops.some((s) => !s)) return { error: `unknown stop; use ${stations.map((s) => s.id).join(', ')}` };
    const legs = planner.legs('rover', stops), tl = planTimeline(habXZ, stops, plan.speed, undefined, legs), limit = EVA_H - plan.reserveH;
    const f = feasibility({ legs, totalH: tl.totalH, evaH: EVA_H, reserveH: plan.reserveH, stops, inWalkBack: (s) => planner.inWalkBack(s.xz, plan.workH, EVA_H), backup: plan.backup });
    return { feasible: f.feasible, reasons: f.reasons, total_h: +tl.totalH.toFixed(2), km: +tl.km.toFixed(1), km_straight: +legs.reduce((s, l) => s + l.kmStraight, 0).toFixed(1), back_at: fmtClock(plan.start, tl.totalH), fits_before_reserve: tl.totalH <= limit, margin_h: +(limit - tl.totalH).toFixed(2), note: 'times from the slope-aware rover path over the terrain classes (placeholder speeds, verify)' };
  }
  return { error: 'unknown tool' };
}

const SYSTEM = `You are A.R.E.S., the field companion for a four-person crew on a simulated Mars EVA near Chryse Planitia. You speak to one signed-in crew member or agent.
Be brief: one to three short sentences unless asked for more. Plain words, no jargon. Numbers with units.
Use only the mission data you are given and your tools (web_search for outside facts; name the source); say "I don't have that" rather than guessing. Every reading is simulated and many limits are placeholders marked verify: say so when it matters.
Safety first: if the turn-back time is near or passed, say it before anything else. You advise; the crew on site decides. Never claim to control the rover or any hardware.
Health data marked private stays private: do not guess at it.`;

export default function Chat(ctx) {
  const [open, setOpen] = useState(false), [key, setKey] = useState(() => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } });
  const [draft, setDraft] = useState(''), [msgs, setMsgs] = useState([]), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const [listening, setListening] = useState(false), [heard, setHeard] = useState(''), [voice, setVoice] = useState(null); // voice: { phase, heard, reply } while a spoken exchange is on screen
  const history = useRef([]), rec = useRef(null), awaiting = useRef(false), hide = useRef(0), ctxRef = useRef(ctx), listenRef = useRef(null), endRef = useRef(null), askRef = useRef(null);
  useEffect(() => { ctxRef.current = ctx; });
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);

  const say = (text, follow) => { // speak; then either listen for a follow-up without the wake word, or fade the card out
    clearTimeout(hide.current);
    const done = () => {
      if (follow && rec.current?.keep) { awaiting.current = true; setVoice((v) => v && { ...v, phase: 'followup' }); hide.current = setTimeout(() => { awaiting.current = false; setVoice(null); }, 8000); }
      else hide.current = setTimeout(() => setVoice(null), 6000);
    };
    if (!window.speechSynthesis) return done();
    window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.onend = done; u.onerror = done; window.speechSynthesis.speak(u);
  };
  const ask = async (text, spoken) => {
    text = text.trim(); if (!text || busy) return;
    if (!key) { setOpen(true); setErr('Add your API key first.'); if (spoken) { const m = 'Add your API key in the A.R.E.S. panel and I can answer.'; setVoice({ phase: 'reply', heard: text, reply: m }); say(m); } return; }
    if (spoken) { clearTimeout(hide.current); setVoice({ phase: 'thinking', heard: text }); }
    setErr(''); setBusy(true); setMsgs((m) => [...m, { who: 'you', text }]);
    const g = isGemini(key), o = isOllama(key), sys = () => `${SYSTEM}\n\nMission data right now (JSON):\n${JSON.stringify(snapshot(ctxRef.current))}`;
    const reply = (answer) => { setMsgs((m) => [...m, { who: 'ares', text: answer }]); if (spoken) { setVoice({ phase: 'reply', heard: text, reply: answer }); say(answer, true); } };
    const refuse = () => { setMsgs((m) => [...m, { who: 'ares', text: 'I can\'t help with that one.' }]); if (spoken) setVoice(null); };
    // History is in the format of whichever service the key belongs to; saving a new key clears it.
    const messages = [...history.current, g ? { role: 'user', parts: [{ text }] } : { role: 'user', content: text }];
    let answered = false;
    const tool = async (name, input) => { if (name !== 'web_search') return runTool(name, input, ctxRef.current); try { return await searchWeb(key, String(input.query ?? '')); } catch (e) { return { error: `web search failed: ${e?.message ?? e}` }; } };
    try {
      if (o) { // small local models have no tool use: the mission data in the prompt has to do
        const res = await fetch(`${OLLAMA}/api/chat`, { method: 'POST', body: JSON.stringify({ model: ollamaModel(key), stream: false, keep_alive: '30m', options: { temperature: 0.2 }, messages: [{ role: 'system', content: `${SYSTEM}

Key facts, already worked out (use these exact times and distances):
${facts(ctxRef.current)}

More mission data (JSON):
${JSON.stringify(snapshot(ctxRef.current))}` }, ...messages] }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(j.error ?? res.statusText), { status: res.status });
        const answer = j.message?.content?.trim() || '(no answer)';
        messages.push({ role: 'assistant', content: answer }); reply(answer); answered = true;
      } else if (g) {
        for (let i = 0; i < 6; i++) { // a few tool rounds at most
          const j = await gemini(key, sys(), messages), content = j.candidates?.[0]?.content;
          if (!content?.parts) { refuse(); break; } // blocked by safety settings, or empty
          messages.push(content); // as received, so Gemini's thought signatures go back unchanged
          const calls = content.parts.filter((x) => x.functionCall);
          if (!calls.length) { reply(content.parts.filter((x) => x.text && !x.thought).map((x) => x.text).join('').trim() || '(no answer)'); answered = true; break; }
          messages.push({ role: 'user', parts: await Promise.all(calls.map(async ({ functionCall: f }) => ({ functionResponse: { name: f.name, ...(f.id ? { id: f.id } : {}), response: { result: await tool(f.name, f.args ?? {}) } } }))) });
        }
      } else {
        const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
        for (let i = 0; i < 6; i++) {
          const r = await client.messages.create({ model: MODEL, max_tokens: 8000, output_config: { effort: 'low' }, tools: TOOLS, system: sys(), messages });
          messages.push({ role: 'assistant', content: r.content });
          if (r.stop_reason === 'refusal') { refuse(); break; }
          const uses = r.content.filter((b) => b.type === 'tool_use');
          if (r.stop_reason !== 'tool_use' || !uses.length) { reply(r.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim() || '(no answer)'); answered = true; break; }
          messages.push({ role: 'user', content: await Promise.all(uses.map(async (u) => ({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(await tool(u.name, u.input ?? {})) }))) });
        }
      }
      if (answered) history.current = messages; // shortcut: whole chat resent each turn, trim it if chats get long
    } catch (e) {
      const m = o && !e?.status ? `Could not reach Ollama on this computer. Is it running? On the live site, set OLLAMA_ORIGINS to allow it (${e?.message ?? e}).` : `${o ? 'Ollama' : g ? 'Gemini' : 'Claude'} said: ${e?.message ?? e}${[400, 401, 403].includes(e?.status) ? ' (check the key: Remove key, paste a fresh one from the provider, save)' : ''}`; // the provider's own words, so a bad key is told apart from a bad request
      setErr(m); if (spoken) { setVoice({ phase: 'reply', heard: text, reply: m }); say(m); }
    } finally { setBusy(false); }
  };
  useEffect(() => { askRef.current = ask; });

  const listen = () => { // continuous listening for "Hey Aries"; the browser asks for the microphone first
    if (listening) { rec.current?.stop(); setListening(false); return; }
    const r = new SR(); r.continuous = true; r.interimResults = false; r.lang = 'en-IN';
    r.onresult = (e) => {
      if (window.speechSynthesis?.speaking) return; // don't hear our own voice
      const said = e.results[e.results.length - 1][0].transcript; setHeard(said);
      if (awaiting.current) { awaiting.current = false; askRef.current(said, true); return; } // the question after a bare "Hey Aries"
      const m = said.match(WAKE); if (!m) return;
      const q = said.slice(m.index + m[0].length);
      if (q.trim()) askRef.current(q, true);
      else { awaiting.current = true; clearTimeout(hide.current); setVoice({ phase: 'listening' }); hide.current = setTimeout(() => { awaiting.current = false; setVoice(null); }, 10000); }
    };
    r.onend = () => { if (rec.current === r && r.keep) r.start(); }; // Chrome stops after silence; restart while on
    r.onerror = (e) => { if (e.error === 'not-allowed') { r.keep = false; setListening(false); setErr('Microphone blocked. Allow it in the browser to use "Hey Aries".'); } };
    r.keep = true; rec.current = r; r.start(); setListening(true);
  };
  useEffect(() => { // start listening by itself once the microphone has been allowed for this site
    if (!SR) return;
    navigator.permissions?.query({ name: 'microphone' }).then((p) => { if (p.state === 'granted' && !rec.current) listenRef.current(); }).catch(() => { /* browser can't report it: use the button */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listenRef.current = listen; });
  useEffect(() => () => { if (rec.current) { rec.current.keep = false; rec.current.stop(); } }, []);
  const talk = () => { // push to talk: the next thing said is the question, no wake word needed
    if (!rec.current?.keep) listen();
    window.speechSynthesis?.cancel(); awaiting.current = true; clearTimeout(hide.current); setVoice({ phase: 'listening' });
    hide.current = setTimeout(() => { awaiting.current = false; setVoice(null); }, 10000);
  };
  const stopListen = () => { if (rec.current) { rec.current.keep = false; rec.current.stop(); } setListening(false); };

  useEffect(() => { // load the local model ahead of the first question; the first load takes about a minute
    if (isOllama(key)) fetch(`${OLLAMA}/api/chat`, { method: 'POST', body: JSON.stringify({ model: ollamaModel(key), messages: [], keep_alive: '30m' }) }).catch(() => { /* reported on the first question */ });
  }, [key]);
  const saveKey = (k) => { setKey(k); history.current = []; try { if (k) localStorage.setItem(KEY, k); else localStorage.removeItem(KEY); } catch { /* storage blocked: key lasts this page only */ } };

  return (
    <div className="chat">
      {open && (
        <section className="chat-panel" aria-label="A.R.E.S. companion">
          <header className="chat-head">
            <strong>A.R.E.S.</strong>
            {SR && <button className="btn btn-s btn-primary" onClick={talk}>Talk</button>}
            {SR && <button className="btn btn-s" aria-pressed={listening} onClick={listening ? stopListen : listen}>{listening ? 'Listening for "Hey Aries"' : 'Turn on "Hey Aries"'}</button>}
            <button className="btn btn-s" onClick={() => setOpen(false)} aria-label="Close">Close</button>
          </header>
          {!key ? (
            <form className="chat-key" onSubmit={(e) => { e.preventDefault(); saveKey(new FormData(e.currentTarget).get('k').trim()); setErr(''); }}>
              <p className="small">Paste your own API key to turn A.R.E.S. on: a Google Gemini key from Google AI Studio or an Anthropic key. Or type ollama to use the model running on this computer.</p>
              <label className="field small">API key<input name="k" type="password" autoComplete="off" required /></label>
              <p className="note">The key stays in this browser only and goes straight to Google or Anthropic. Don't use it on a shared computer.</p>
              <button className="btn btn-primary">Save key</button>
            </form>
          ) : <>
            <ol className="chat-log" aria-live="polite">
              {!msgs.length && <li className="chat-hint small muted">Ask about the route, the turn-back time, your tasks, or "what if we skip S2?"{SR ? ' Or say "Hey Aries" with listening on.' : ''}</li>}
              {msgs.map((m, i) => <li key={i} className={'chat-msg is-' + m.who}>{m.text}</li>)}
              {busy && <li className="chat-msg is-ares muted">Thinking…</li>}
              <li ref={endRef} aria-hidden="true" />
            </ol>
            <form className="chat-ask" onSubmit={(e) => { e.preventDefault(); ask(draft); setDraft(''); }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask A.R.E.S." aria-label="Ask A.R.E.S." />
              <button className="btn btn-primary" disabled={busy || !draft.trim()}>Ask</button>
            </form>
            <p className="chat-foot small muted">{listening && heard ? `Heard: "${heard}" · ` : ''}Advice only; the crew decides. <button className="link" onClick={() => saveKey('')}>Remove key</button></p>
          </>}
          {err && <p className="small warn" role="alert">{err}</p>}
        </section>
      )}
      {voice && (
        <section className="voice" role="status" aria-live="polite" aria-label="A.R.E.S. voice">
          <span className={'voice-orb is-' + voice.phase} aria-hidden="true" />
          <div className="voice-text">
            <p className="voice-state">{voice.phase === 'listening' ? 'Listening. Ask your question.' : voice.phase === 'followup' ? 'Anything else? I’m listening.' : voice.phase === 'thinking' ? 'Thinking…' : 'A.R.E.S.'}</p>
            {voice.heard && <p className="small muted">You: {voice.heard}</p>}
            {voice.reply && <p>{voice.reply}</p>}
          </div>
          <button className="btn btn-s" onClick={() => { awaiting.current = false; window.speechSynthesis?.cancel(); setVoice(null); }}>Close</button>
        </section>
      )}
      {!open && <div className="chat-fabs">
        {SR && <button className="btn chat-fab" onClick={talk}>Talk to A.R.E.S.</button>}
        {SR && <button className="btn chat-fab" aria-pressed={listening} onClick={listening ? stopListen : listen}>{listening ? 'Say "Hey Aries"' : 'Turn on "Hey Aries"'}</button>}
        <button className="btn btn-primary chat-fab" onClick={() => setOpen(true)}>Ask A.R.E.S.</button>
      </div>}
    </div>
  );
}

if (import.meta.env?.DEV) {
  console.assert(WAKE.test('hey aries what is next') && WAKE.test('Hey, ARES.') && WAKE.test('hey Aris what is next') && !WAKE.test('the area is clear'), 'wake word');
}
