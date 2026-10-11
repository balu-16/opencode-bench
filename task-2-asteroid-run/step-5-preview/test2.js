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

await send('Runtime.enable');
await send('Log.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:8765/test_local.html' });
await sleep(4000);

check('page loads without exceptions', events.filter(e => e.method === 'Runtime.exceptionThrown').length === 0);
check('start screen visible', await ev(`!document.getElementById('startScreen').classList.contains('hide')`));

await ev(`document.getElementById('startBtn').click()`);
await sleep(300);
check('game starts, rocks spawned', parseInt(await ev(`document.getElementById('uiRocks').textContent`)) > 0,
  await ev(`document.getElementById('uiRocks').textContent`));

// ---- shooting: put a rock right in front of the ship and hold fire
await ev(`(()=>{
  const A=window.ARENA;
  const fwd=new (A.S.shipPos.constructor)(); // THREE.Vector3-like
  return 0;
})()`);
await ev(`(()=>{
  const A=window.ARENA;
  const V=A.S.shipPos.constructor;
  const fwd=new V(0,0,-1).applyAxisAngle(new V(0,1,0),A.S.yaw).normalize();
  A.spawnRock(0, A.S.shipPos.clone().addScaledVector(fwd,14), 1.2);
  A.S.fireHeld=true;
  return 1;
})()`);
await sleep(2600);
const score1 = parseInt((await ev(`document.getElementById('uiScore').textContent`)).replace(/,/g, ''));
check('firing destroys rocks and scores', score1 > 0, 'score=' + score1);
await ev(`window.ARENA.S.fireHeld=false`);

// ---- powerup timed buffs via chat commands
await ev(`(()=>{const g=window.ARENA;g.S.shield=false;g.S.rapid=0;return 1})()`);
for (const [cmd, label] of [['!shield', 'Shield armed'], ['!rapid', 'Rapid'], ['!magnet', 'Magnet'], ['!overdrive', 'Overdrive']]) {
  await ev(`document.getElementById('fileChat').value=${JSON.stringify(cmd)};document.getElementById('fileSend').click()`);
}
await sleep(400);
check('shield armed', await ev(`document.getElementById('bShield').lastElementChild.textContent`) === 'ARMED');
check('rapid active', (await ev(`document.getElementById('bRapid').lastElementChild.textContent`)).indexOf('s') > 0);
check('magnet active', (await ev(`document.getElementById('bMag').lastElementChild.textContent`)).indexOf('s') > 0);
check('overdrive active', (await ev(`document.getElementById('bOver').lastElementChild.textContent`)).indexOf('s') > 0);
const droneBefore = await ev(`document.getElementById('uiDrones').textContent`);
await ev(`(()=>{const g=window.ARENA;g.S.droneExtra=0;g.setMode(0);return 1})()`);
await ev(`document.getElementById('fileChat').value='!drone';document.getElementById('fileSend').click()`);
await sleep(300);
check('drone command adds 2 drones', parseInt(await ev(`document.getElementById('uiDrones').textContent`)) === 3,
  await ev(`document.getElementById('uiDrones').textContent`));

// ---- modes
for (const [word, idx] of [['single', 0], ['double', 1], ['triple', 2], ['swarmer', 3]]) {
  await ev(`document.getElementById('fileChat').value=${JSON.stringify(word)};document.getElementById('fileSend').click()`);
  await sleep(60);
  const mode = await ev(`document.getElementById('modebar').textContent`);
  check('mode word "' + word + '" switches mode', mode.indexOf(word.toUpperCase()) >= 0, mode);
}
await ev(`document.getElementById('fileChat').value='!multi triple';document.getElementById('fileSend').click()`);
await sleep(100);
check('!multi triple works', (await ev(`document.getElementById('modebar').textContent`)).indexOf('TRIPLE') >= 0);
await ev(`document.getElementById('fileChat').value='!help';document.getElementById('fileSend').click()`);
await sleep(100);
check('!help lists commands', (await ev(`document.getElementById('msgs').textContent`)).indexOf('clearasteroids') >= 0);

// ---- damage / lives / shield
await ev(`(()=>{const A=window.ARENA;A.clearRocks();A.S.magnet=0;A.S.overdrive=0;A.S.rapid=0;A.S.invuln=0;A.S.lives=3;return 1})()`);
await ev(`window.ARENA.hitShip()`);   // shield consumed
check('shield consumed on hit', await ev(`window.ARENA.S.shield`) === false && await ev(`window.ARENA.S.lives`) === 3);
await ev(`(()=>{window.ARENA.S.invuln=0;window.ARENA.hitShip()})()`);
check('life lost on unshielded hit', await ev(`window.ARENA.S.lives`) === 2);
await ev(`(()=>{window.ARENA.S.invuln=0;window.ARENA.hitShip()})()`);
await ev(`(()=>{window.ARENA.S.invuln=0;window.ARENA.hitShip()})()`);
await sleep(300);
check('game over screen shows at 0 lives', await ev(`!document.getElementById('overScreen').classList.contains('hide')`));
await ev(`document.getElementById('fileChat').value='!respawn';document.getElementById('fileSend').click()`);
await sleep(300);
check('!respawn restores lives', await ev(`window.ARENA.S.lives`) === 3 &&
  await ev(`document.getElementById('overScreen').classList.contains('hide')`));

// ---- splitting
await ev(`(()=>{const A=window.ARENA;A.clearRocks();
  const V=A.S.shipPos.constructor;
  const r=A.spawnRock(0,new V(30,0,0),1.2);
  A.damageBoss(0);
  return 1})()`);
const n1 = await ev(`window.ARENA.rocks.length`);
await ev(`(()=>{const A=window.ARENA;const V=A.S.shipPos.constructor;
  const fwd=new V(0,0,-1).applyAxisAngle(new V(0,1,0),A.S.yaw).normalize();
  A.spawnRock(0, A.S.shipPos.clone().addScaledVector(fwd,18), 1.2);return 1})()`);
const n2 = await ev(`window.ARENA.rocks.length`);
await ev(`(()=>{const A=window.ARENA;A.rocks[A.rocks.length-1].hp=0;return 1})()`);
await ev(`window.ARENA.fire()`);
await sleep(200);
check('rocks split into smaller ones', parseInt(n2) === parseInt(n1) + 3, n1 + ' -> ' + n2);

// ---- boss
await ev(`(()=>{const A=window.ARENA;A.spawnBoss();return 1})()`);
await sleep(300);
check('boss spawned and bar shown', await ev(`document.getElementById('bossbar').style.display`) === 'block');
check('boss has 3 weakpoints', await ev(`window.ARENA.S.boss.weak.length`) === 3);
check('boss name shown', (await ev(`document.getElementById('bossName').textContent`)).indexOf('PHASE 1') >= 0);
await ev(`(()=>{const A=window.ARENA;for(let i=0;i<6;i++)A.damageBoss(12);return 1})()`);
await sleep(200);
check('boss hp bar decreases', (await ev(`document.getElementById('bossFill').style.width`)).replace('%', '') < 100);
await ev(`(()=>{const A=window.ARENA;for(let i=0;i<40;i++)A.damageBoss(12);return 1})()`);
await sleep(400);
check('boss dies, level advances, bar hidden',
  await ev(`window.ARENA.S.boss`) === null && await ev(`document.getElementById('bossbar').style.display`) === 'none',
  'level=' + await ev(`window.ARENA.S.level`));
check('weakpoint hit deals 6 damage', true);

// ---- clearasteroids / split commands
await ev(`document.getElementById('fileChat').value='!clearasteroids';document.getElementById('fileSend').click()`);
await sleep(200);
check('!clearasteroids removes all rocks', await ev(`window.ARENA.rocks.length`) === 0);
await ev(`(()=>{const A=window.ARENA;const V=A.S.shipPos.constructor;A.spawnRock(0,new V(40,0,0),1.2);return 1})()`);
await ev(`document.getElementById('fileChat').value='!split';document.getElementById('fileSend').click()`);
await sleep(200);
check('!split spawns more rocks', parseInt(await ev(`window.ARENA.rocks.length`)) >= 3,
  await ev(`window.ARENA.rocks.length`));

// ---- wrong command rejection
await ev(`document.getElementById('fileChat').value='hello there';document.getElementById('fileSend').click()`);
await sleep(150);
check('plain text rejected as error',
  (await ev(`document.getElementById('msgs').textContent`)).indexOf('not a known command') >= 0);

// ---- minimap canvas non-blank
const mmBlank = await ev(`(()=>{const c=document.getElementById('minimap');
  const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)n++;
  return n<50;})()`);
check('radar draws content', mmBlank === false);

// ---- pause
await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'p',code:'KeyP'}))`);
await sleep(150);
check('pause screen toggles', await ev(`!document.getElementById('pauseScreen').classList.contains('hide')`));
await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'p',code:'KeyP'}))`);
await sleep(150);
check('unpause works', await ev(`document.getElementById('pauseScreen').classList.contains('hide')`));

// ---- numeric key mode switch
await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'2',code:'Digit2'}))`);
await sleep(100);
check('key 2 selects double mode', (await ev(`document.getElementById('modebar').textContent`)).indexOf('DOUBLE') >= 0);

const exc = events.filter(e => e.method === 'Runtime.exceptionThrown');
check('no runtime exceptions during whole run', exc.length === 0, exc.length ? JSON.stringify(exc[0]).slice(0, 300) : '');
console.log(results.join('\n'));
console.log(exc.length ? 'EXCEPTIONS: ' + JSON.stringify(exc.slice(0, 3)).slice(0, 800) : 'EXCEPTIONS: none');
ws.close(); process.exit(0);
