const base = 'http://127.0.0.1:9222';
const list = await (await fetch(base + '/json/list')).json();
const page = list.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const events = [];
const results = [];
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
  if (r.result && r.result.exceptionDetails) return 'EXC ' + JSON.stringify(r.result.exceptionDetails).slice(0, 200);
  return r.result && r.result.result ? r.result.result.value : undefined;
}
function check(name, cond, extra) {
  results.push((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  [' + extra + ']' : ''));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cmd = async c => { await ev(`document.getElementById('fileChat').value=${JSON.stringify(c)};document.getElementById('fileSend').click()`); };

await send('Runtime.enable');
await send('Log.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:8765/test_local.html' });
await sleep(4000);
await ev(`document.getElementById('startBtn').click()`);
await sleep(300);

// ---- split on kill with proper wait
await ev(`(()=>{const A=window.ARENA;A.clearRocks();return 1})()`);
await ev(`(()=>{const A=window.ARENA;const V=A.S.shipPos.constructor;
  const fwd=new V(0,0,-1).applyAxisAngle(new V(0,1,0),A.S.yaw).normalize();
  A.spawnRock(0, A.S.shipPos.clone().addScaledVector(fwd,20), 1.2);return 1})()`);
const before = await ev(`window.ARENA.rocks.length`);
const depthsBefore = await ev(`JSON.stringify(window.ARENA.rocks.map(r=>r.depth))`);
await ev(`window.ARENA.fire()`);
await sleep(1500);
const after = await ev(`window.ARENA.rocks.length`);
const depthsAfter = await ev(`JSON.stringify(window.ARENA.rocks.map(r=>r.depth))`);
check('rock splits into two children', parseInt(after) === 2 && depthsAfter.indexOf('[1,1]') >= 0,
  before + ' ' + depthsBefore + ' -> ' + after + ' ' + depthsAfter);

// ---- minimum radius stop
await ev(`(()=>{const A=window.ARENA;A.clearRocks();
  const V=A.S.shipPos.constructor;
  const fwd=new V(0,0,-1).applyAxisAngle(new V(0,1,0),A.S.yaw).normalize();
  const r=A.spawnRock(2, A.S.shipPos.clone().addScaledVector(fwd,20), 0.45);
  r.radius=0.45;return 1})()`);
await ev(`window.ARENA.fire()`);
await sleep(1500);
check('depth-2 rock vanishes without splitting', await ev(`window.ARENA.rocks.length`) === 0,
  'count=' + await ev(`window.ARENA.rocks.length`));

// ---- clearasteroids feedback
await cmd('!clearasteroids');
await sleep(150);
check('!clearasteroids accepted',
  (await ev(`document.getElementById('msgs').textContent`)).indexOf('!clearasteroids') >= 0);

// ---- multiplier progression
await ev(`(()=>{const A=window.ARENA;A.S.mult=1;A.S.killsToNext=14;return 1})()`);
await ev(`(()=>{const A=window.ARENA;
  const V=A.S.shipPos.constructor;
  for(let i=0;i<5;i++){
    const fwd=new V(0,0,-1).applyAxisAngle(new V(0,1,0),A.S.yaw+i*0.001).normalize();
    A.spawnRock(0, A.S.shipPos.clone().addScaledVector(fwd,20+i*0.01), 1.2);
  }
  return 1})()`);
for (let i = 0; i < 12; i++) { await ev(`window.ARENA.fire()`); await sleep(120); }
const mult = await ev(`document.getElementById('uiMult').textContent`);
const barShown = await ev(`document.getElementById('multbar').style.display`);
check('multiplier increases after enough kills', parseInt(mult.replace('x', '')) >= 2, mult + ' bar=' + barShown);

// ---- boss phases + enrage + weakpoint damage
await ev(`(()=>{const A=window.ARENA;A.spawnBoss();return 1})()`);
await sleep(200);
const phase1Name = await ev(`document.getElementById('bossName').textContent`);
await ev(`(()=>{const A=window.ARENA;for(let i=0;i<10;i++)A.damageBoss(15);return 1})()`);
await sleep(150);
const phase2Name = await ev(`document.getElementById('bossName').textContent`);
check('boss phase changes with hp', phase2Name !== phase1Name, phase1Name + ' -> ' + phase2Name);
await ev(`(()=>{const A=window.ARENA;for(let i=0;i<40;i++)A.damageBoss(10);return 1})()`);
await sleep(200);
const enraged = await ev(`window.ARENA.S.boss===null`);
check('boss dies at 0 hp', enraged === true || enraged === 'null', 'boss=' + enraged);

// weakpoint damage number
await ev(`(()=>{const A=window.ARENA;A.spawnBoss();return 1})()`);
await sleep(200);
const hpBefore = await ev(`window.ARENA.S.boss.hp`);
await ev(`(()=>{const A=window.ARENA;const b=A.S.boss;const w=b.weak[0];
  const bl=A.bullets.get();
  bl.mesh.position.copy(w.mesh.position);
  bl.vel.set(0,0,0);
  bl.life=5;
  return 1})()`);
await sleep(300);
const hpAfter = await ev(`window.ARENA.S.boss?A(S_safe)():0`.replace('A(S_safe)()', 'window.ARENA.S.boss.hp'));
check('weakpoint hit deals 6 damage', hpBefore - hpAfter === 6, hpBefore + ' -> ' + hpAfter);

// ---- drone count reflects mode + extras
await ev(`(()=>{const A=window.ARENA;A.setMode(3);A.S.droneExtra=0;A.setMode(3);return 1})()`);
check('swarmer mode spawns 6 drones', await ev(`window.ARENA.drones.length`) === 6,
  'drones=' + await ev(`window.ARENA.drones.length`));
await cmd('!drone');
await sleep(150);
check('!drone adds two more', await ev(`window.ARENA.drones.length`) === 8,
  'drones=' + await ev(`window.ARENA.drones.length`));

// ---- extra life powerup
await cmd('!shield');
await sleep(100);
check('shield powerup armed', await ev(`window.ARENA.S.shield`) === true);

// ---- magnet pull changes velocity
await cmd('!magnet');
await sleep(100);
check('magnet timer set', await ev(`window.ARENA.S.magnet`) > 5, 'magnet=' + await ev(`window.ARENA.S.magnet`));

const exc = events.filter(e => e.method === 'Runtime.exceptionThrown');
check('no runtime exceptions', exc.length === 0, exc.length ? JSON.stringify(exc[0]).slice(0, 200) : '');
console.log(results.join('\n'));
console.log(exc.length ? 'EXC ' + JSON.stringify(exc.slice(0, 2)).slice(0, 600) : 'EXC none');
ws.close(); process.exit(0);
