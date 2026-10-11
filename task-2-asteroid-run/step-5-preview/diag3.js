const base = 'http://127.0.0.1:9222';
const list = await (await fetch(base + '/json/list')).json();
const page = list.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const events = [];
ws.addEventListener('message', ev => {
  let m = null;
  try { m = JSON.parse(ev.data); } catch (e) { return; }
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method) events.push(m);
});
await new Promise(r => ws.addEventListener('open', r));
const send = (method, params) => new Promise(res => {
  const i = ++id; pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params: params || {} }));
});
async function ev(expr, awaitPromise) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: !!awaitPromise });
  return r.result;
}
function show(label, v) {
  try { console.log(label + ': ' + String(v)); } catch (e) { console.log(label + ': <unprintable>'); }
}
try {
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8765/asteroids.html' });
  await new Promise(r => setTimeout(r, 6000));
  show('fetch', await ev(`fetch('https://unpkg.com/three@0.161.0/build/three.module.js').then(r=>'status '+r.status).catch(e=>'ERR '+e.message)`, true));
  show('esm', await ev(`import('https://unpkg.com/three@0.161.0/build/three.module.js').then(m=>'keys '+Object.keys(m).length).catch(e=>'ERR '+e.message)`, true));
  show('exceptions', events.filter(e => e.method === 'Runtime.exceptionThrown').length);
  show('console', events.filter(e => e.method === 'Runtime.consoleAPICalled').map(e => e.params.type).join(','));
} catch (e) {
  console.log('FAILED: ' + e.message);
}
ws.close(); process.exit(0);
