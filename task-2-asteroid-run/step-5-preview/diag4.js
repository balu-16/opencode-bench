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
await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:8765/asteroids.html' });
await new Promise(r => setTimeout(r, 8000));
for (const e of events) {
  let p = e.params || {};
  let line = e.method;
  if (e.method === 'Log.entryAdded') line += ' [' + p.entry.level + '] ' + p.entry.source + ' ' + p.entry.text + ' ' + (p.entry.url || '');
  if (e.method === 'Network.responseReceived') line += ' ' + p.response.url + ' ' + p.response.status;
  if (e.method === 'Network.requestWillBeSent') line += ' REQ ' + p.request.url;
  if (e.method === 'Network.loadingFailed') line += ' FAILED ' + (p.requestId) + ' ' + (p.errorText || '');
  if (e.method === 'Runtime.exceptionThrown') line += ' ' + JSON.stringify(p.exceptionDetails).slice(0, 300);
  console.log(line);
}
ws.close(); process.exit(0);
