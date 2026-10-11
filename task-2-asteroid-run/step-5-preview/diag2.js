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
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  return r.result.result ? r.result.result.value : ('ERR ' + JSON.stringify(r.result.exceptionDetails || {}));
}
await send('Runtime.enable');
await send('Log.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:8765/asteroids.html' });
await new Promise(r => setTimeout(r, 8000));
const out = {};
out.url = await ev('location.href');
out.scripts = await ev('document.scripts.length');
out.moduleLen = await ev(`(()=>{const s=document.querySelector('script[type=module]');return s?s.text.length:'none'})()`);
out.htmlLen = await ev('document.documentElement.outerHTML.length');
out.fetchTest = await ev(`fetch('https://unpkg.com/three@0.161.0/build/three.module.js').then(r=>r.status).catch(e=>'ERR '+e.message)`);
out.esmTest = await ev(`import('https://unpkg.com/three@0.161.0/build/three.module.js').then(m=>'ok '+Object.keys(m).length).catch(e=>'ERR '+e.message)`);
out.exceptions = events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => JSON.stringify(e.params.exceptionDetails)).slice(0, 3);
out.console = events.filter(e => e.method === 'Runtime.consoleAPICalled').map(e => e.params.type + ' ' + JSON.stringify(e.params.args.map(a => a.value))).slice(0, 12);
console.log(JSON.stringify(out, null, 1));
ws.close(); process.exit(0);
