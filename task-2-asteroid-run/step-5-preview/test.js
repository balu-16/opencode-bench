const base = 'http://127.0.0.1:9222';
const list = await (await fetch(base + '/json/list')).json();
const page = list.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const errors = [];
const logs = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errors.push('CONSOLE ' + JSON.stringify(m.params.args.map(a => a.value || a.description)));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    errors.push('EXCEPTION ' + JSON.stringify(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text));
  }
});
await new Promise(r => ws.addEventListener('open', r));
const send = (method, params) => new Promise(res => {
  const i = ++id;
  pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params: params || {} }));
});
async function evaluate(expr, awaitPromise = false) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
  if (r.result && r.result.exceptionDetails) throw new Error('EVAL ERR: ' + JSON.stringify(r.result.exceptionDetails));
  return r.result && r.result.result ? r.result.result.value : undefined;
}

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:8765/test_local.html' });
await new Promise(r => setTimeout(r, 4000));

const res = {};
res.title = await evaluate('document.title');
res.scoreStart = await evaluate('document.getElementById("uiScore").textContent');
res.visible = await evaluate('!document.getElementById("startScreen").classList.contains("hide")');
res.threeLoaded = await evaluate('typeof window.__x === "undefined" ? "n/a" : "n/a"');
res.msgsCount = await evaluate('document.getElementById("msgs").children.length');

// launch the game
await evaluate('document.getElementById("startBtn").click()');
await new Promise(r => setTimeout(r, 500));
res.afterStart = {
  running: await evaluate('document.getElementById("startScreen").classList.contains("hide")'),
  lives: await evaluate('document.getElementById("uiLives").textContent'),
  rocks: await evaluate('document.getElementById("uiRocks").textContent'),
  chatMsgs: await evaluate('document.getElementById("msgs").children.length')
};

// simulate key input: hold W and fire
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'w',code:'KeyW'}))`);
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space'}))`);
await new Promise(r => setTimeout(r, 2500));
res.moved = await evaluate('document.getElementById("uiRocks").textContent');

// chat commands via file:// style override input
await evaluate(`document.getElementById('fileChat').value='!shield'`);
await evaluate(`document.getElementById('fileSend').click()`);
await new Promise(r => setTimeout(r, 200));
res.shieldBuff = await evaluate(`document.getElementById('bShield').lastElementChild.textContent`);

await evaluate(`document.getElementById('fileChat').value='swarmer'`);
await evaluate(`document.getElementById('fileSend').click()`);
await new Promise(r => setTimeout(r, 300));
res.mode = await evaluate(`document.getElementById('modebar').textContent`);
res.drones = await evaluate(`document.getElementById('uiDrones').textContent`);

await evaluate(`document.getElementById('fileChat').value='!drone'`);
await evaluate(`document.getElementById('fileSend').click()`);
await new Promise(r => setTimeout(r, 300));
res.dronesAfter = await evaluate(`document.getElementById('uiDrones').textContent`);

await evaluate(`document.getElementById('fileChat').value='!blahblah'`);
await evaluate(`document.getElementById('fileSend').click()`);
await new Promise(r => setTimeout(r, 200));
res.errFeed = await evaluate(`Array.from(document.querySelectorAll('#feed .feedline.err')).map(e=>e.textContent)`);

await evaluate(`document.getElementById('fileChat').value='!boss'`);
await evaluate(`document.getElementById('fileSend').click()`);
await new Promise(r => setTimeout(r, 1500));
res.bossBar = await evaluate(`document.getElementById('bossbar').style.display`);
res.weakHits = await evaluate(`document.getElementById('msgs').textContent.includes('BOSS INCOMING')`);

await evaluate(`document.getElementById('fileChat').value='!rapid'`);
await evaluate(`document.getElementById('fileSend').click()`);
res.rapid = await evaluate(`document.getElementById('bRapid').lastElementChild.textContent`);

await evaluate(`document.getElementById('fileChat').value='!overdrive'`);
await evaluate(`document.getElementById('fileSend').click()`);
res.over = await evaluate(`document.getElementById('bOver').lastElementChild.textContent`);

await evaluate(`document.getElementById('fileChat').value='!magnet'`);
await evaluate(`document.getElementById('fileSend').click()`);
res.mag = await evaluate(`document.getElementById('bMag').lastElementChild.textContent`);

await evaluate(`document.getElementById('fileChat').value='!respawn'`);
await evaluate(`document.getElementById('fileSend').click()`);
res.respawnRejected = await evaluate(`document.getElementById('msgs').textContent.includes('could not be applied')`);

// game over / respawn path
await evaluate(`for(let i=0;i<4;i++)window.dispatchEvent(new KeyboardEvent('keydown',{key:'r',code:'KeyR'}))`);
await new Promise(r => setTimeout(r, 4000));
res.finalScore = await evaluate(`document.getElementById('uiScore').textContent`);
res.mult = await evaluate(`document.getElementById('uiMult').textContent`);

// canvas actually rendering pixels
res.canvasSize = await evaluate(`(()=>{const c=document.getElementById('c');return [c.width,c.height];})()`);

console.log(JSON.stringify(res, null, 1));
console.log('ERRORS:', errors.length ? errors.slice(0, 10) : 'none');
ws.close();
process.exit(0);
