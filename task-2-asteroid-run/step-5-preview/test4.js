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
await sleep(400);
await ev(`window.ARENA.setMode(0)`);

// helper: clear everything and freeze the auto-advance by keeping one deep rock alive
await ev(`(()=>{const A=window.ARENA;A.clearRocks();
  const V=A.S.shipPos.constructor;
  const anchor=A.spawnRock(2, new V(0,-40,60), 0.45);
  return 1})()`);
await sleep(100);
const state = await ev(`JSON.stringify({n:window.ARENA.rocks.length, depths:window.ARENA.rocks.map(r=>r.depth)})`);
check('field can be reset to a single depth-2 rock', state.indexOf('[2]') >= 0, state);

// spawn one depth-0 rock in front of the ship and shoot it
await ev(`(()=>{const A=window.ARENA;const V=A.S.shipPos.constructor;
  const fwd=new V(0,0,-1).applyAxisAngle(new V(0,1,0),A.S.yaw).normalize();
  A.spawnRock(0, A.S.shipPos.clone().addScaledVector(fwd,22), 1.2);return 1})()`);
await ev(`window.ARENA.fire()`);
await sleep(1600);
const after = await ev(`JSON.stringify(window.ARENA.rocks.map(r=>r.depth).sort())`);
check('one shot on a depth-0 rock yields two depth-1 rocks',
  after.indexOf('[1,1,2]') >= 0, after);

// depth-2 rock: single hit destroys, no split
const before2 = await ev(`window.ARENA.rocks.filter(r=>r.depth===2).length`);
await ev(`(()=>{const A=window.ARENA;const V=A.S.shipPos.constructor;
  const fwd=new V(0,0,-1).applyAxisAngle(new V(0,1,0),A.S.yaw).normalize();
  const r=A.rocks.find(x=>x.depth===2);
  r.mesh.position.copy(A.S.shipPos.clone().addScaledVector(fwd,22));
  r.vel.set(0,0,0);return 1})()`);
await ev(`window.ARENA.fire()`);
await sleep(1600);
const after2 = await ev(`window.ARENA.rocks.filter(r=>r.depth===2).length`);
check('depth-2 rock is destroyed without splitting', after2 === before2 - 1, before2 + ' -> ' + after2);

// multiplier: lower the requirement then kill one
await ev(`(()=>{const A=window.ARENA;A.S.mult=1;A.S.killsToNext=1;return 1})()`);
await ev(`(()=>{const A=window.ARENA;const V=A.S.shipPos.constructor;
  const fwd=new V(0,0,-1).applyAxisAngle(new V(0,1,0),A.S.yaw).normalize();
  const r=A.spawnRock(0, A.S.shipPos.clone().addScaledVector(fwd,22), 1.2);
  r.vel.set(0,0,0);return 1})()`);
await ev(`window.ARENA.fire()`);
await sleep(1400);
const mult = await ev(`document.getElementById('uiMult').textContent`);
check('multiplier levels up after kill quota', mult === 'x2', mult + ' bar=' + await ev(`document.getElementById('multbar').style.display`));

// boss weakpoint priority
await ev(`(()=>{const A=window.ARENA;A.spawnBoss();return 1})()`);
await sleep(250);
const hp0 = await ev(`window.ARENA.S.boss.hp`);
await ev(`(()=>{const A=window.ARENA;const b=A.S.boss;const w=b.weak[1];
  const bl=A.bullets.get();
  bl.mesh.position.copy(w.mesh.position);
  bl.vel.set(0,0,0);bl.life=5;return 1})()`);
await sleep(250);
const hp1 = await ev(`window.ARENA.S.boss.hp`);
check('weakpoint hit deals 6 damage', hp0 - hp1 === 6, hp0 + ' -> ' + hp1);
const wpLog = await ev(`document.getElementById('msgs').textContent.indexOf('weakpoint hit')>=0`);
check('weakpoint hit reported in chat log', wpLog === true);

// body hit deals 1
const hpA = await ev(`window.ARENA.S.boss.hp`);
await ev(`(()=>{const A=window.ARENA;const b=A.S.boss;
  const bl=A.bullets.get();
  const V=A.S.shipPos.constructor;
  bl.mesh.position.copy(b.mesh.position.clone().add(new V(0,0,4)));
  bl.vel.set(0,0,0);bl.life=5;return 1})()`);
await sleep(250);
const hpB = await ev(`window.ARENA.S.boss.hp`);
check('boss body hit deals 1 damage', hpA - hpB === 1, hpA + ' -> ' + hpB);

// boss phases and enrage
const p1 = await ev(`document.getElementById('bossName').textContent`);
await ev(`(()=>{const A=window.ARENA;for(let i=0;i<8;i++)A.damageBoss(20);return 1})()`);
await sleep(200);
const p2 = await ev(`document.getElementById('bossName').textContent`);
await ev(`(()=>{const A=window.ARENA;for(let i=0;i<40;i++)A.damageBoss(10);return 1})()`);
await sleep(300);
check('boss phases progress and bar hides on death', p1 !== p2 &&
  await ev(`window.ARENA.S.boss`) === 'null', p1 + ' -> ' + p2);
const enragedSeen = p2.indexOf('ENRAGED') >= 0 || p1.indexOf('ENRAGED') >= 0;
check('enrage label appears in final phase', enragedSeen === true, p2);

// drones: swarmer + command
await ev(`window.ARENA.setMode(3)`);
await sleep(120);
check('swarmer mode = 6 drones', await ev(`window.ARENA.drones.length`) === 6);
await cmd('!drone');
await sleep(200);
check('!drone adds two drones', await ev(`window.ARENA.drones.length`) === 8);
check('drone count shown in HUD', await ev(`document.getElementById('uiDrones').textContent`) === '8');

const exc = events.filter(e => e.method === 'Runtime.exceptionThrown');
check('no runtime exceptions', exc.length === 0, exc.length ? JSON.stringify(exc[0]).slice(0, 200) : '');
console.log(results.join('\n'));
console.log(exc.length ? 'EXC ' + JSON.stringify(exc.slice(0, 2)).slice(0, 600) : 'EXC none');
ws.close(); process.exit(0);
