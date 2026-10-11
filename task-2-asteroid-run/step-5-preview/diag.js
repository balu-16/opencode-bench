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
  return r.result;
}
await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:8765/asteroids.html' });
await new Promise(r => setTimeout(r, 12000));
const out = {};
out.resources = (await ev(`JSON.stringify(performance.getEntriesByType('resource').map(r=>r.name+' '+r.responseStatus+' '+Math.round(r.duration)))`)).result.value;
out.scriptState = (await ev(`(()=>{const s=document.querySelector('script[type=module]');return s?s.readyState:'missing'})()`)).result.value;
out.webgl2 = (await ev(`(()=>{try{return !!document.createElement('canvas').getContext('webgl2')}catch(e){return 'err'}})()`)).result.value;
out.canvas = (await ev(`(()=>{const c=document.getElementById('c');return c.width+'x'+c.height})()`)).result.value;
out.msgs = (await ev(`document.getElementById('msgs').children.length`)).result.value;
out.glContextLost = (await ev(`(()=>{const c=document.getElementById('c');return c.getContext('webgl2')?'has-ctx':'no-ctx-attached'})()`)).result.value;
out.exceptions = events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => JSON.stringify(e.params.exceptionDetails)).slice(0, 5);
out.console = events.filter(e => e.method === 'Runtime.consoleAPICalled').map(e => e.params.type + ' ' + JSON.stringify(e.params.args.map(a => a.value))).slice(0, 12);
out.netFail = events.filter(e => e.method === 'Network.loadingFailed').map(e => JSON.stringify(e.params)).slice(0, 5);
console.log(JSON.stringify(out, null, 1));
ws.close(); process.exit(0);
