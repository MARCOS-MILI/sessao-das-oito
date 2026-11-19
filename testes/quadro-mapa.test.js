const { chromium, devices } = require('playwright');
const fs = require('fs');
/* Teste do quadro (mapa, peças e fotos) contra um Supabase de mentira (stub-supabase.js).
   Como rodar: na raiz do repositório, "python3 -m http.server 8802" e, em outro terminal,
   "node testes/quadro-mapa.test.js". Com SHOTS=pasta, salva as telas lá. */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const STUB = fs.readFileSync(path.join(__dirname, 'stub-supabase.js'), 'utf8');
const IMG = fs.readFileSync(path.join(ROOT, 'pecas/ingresso-sessao-das-oito.webp'));
const BASE = process.env.BASE || 'http://localhost:8802/';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
async function ctxNew(b, opts = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  await ctx.route('**/supabase.js', r => r.fulfill({ contentType: 'application/javascript', body: STUB }));
  await ctx.route('https://stub-storage.test/**', r => r.fulfill({ contentType: 'image/webp', body: IMG }));
  if (opts.noMap) await ctx.addInitScript(() => { window.__stubNoMap = true; });
  return ctx;
}
function watch(p, tag) { p.on('pageerror', e => { console.log('PAGEERROR ' + tag + ': ' + e.message); fails++; }); }
const shot = (p, n) => process.env.SHOTS ? p.screenshot({ path: path.join(process.env.SHOTS, 'm-' + n + '.png') }) : null;
const tokXY = (p, name) => p.evaluate(n => { const el = [...document.querySelectorAll('.tok')].find(e => e.textContent.trim().toUpperCase().endsWith(n.toUpperCase())); if (!el) return null; const m = el.style.transform.match(/translate\((-?\d+)px, ?(-?\d+)px\)/); return m ? [+m[1], +m[2]] : null; }, name);

(async () => {
  const b = await chromium.launch();
  /* ---------- mesa ao vivo, duas telas ---------- */
  const ctx = await ctxNew(b);
  const A = await ctx.newPage(); watch(A, 'A');
  await A.goto(BASE + '#mesa');
  await A.fill('#s-name', 'Mili'); await A.fill('#s-code', 'teste1'); await A.click('#s-go');
  await A.waitForTimeout(800);
  ok(await A.isVisible('#modes'), 'chave Quadro/Mapa aparece');
  await A.click('#modes [data-mode="mapa"]'); await A.waitForTimeout(400);
  ok((await A.textContent('#liveNote')).includes('Nenhum mapa'), 'mapa vazio avisa');
  await shot(A, '1-vazio');
  await A.click('[data-act="maps"]'); await A.waitForTimeout(200);
  await shot(A, '2-folha-mapas');
  await A.click('[data-madd="cidade"]'); await A.waitForTimeout(1200);
  ok(/mapa-jogadores-antes/.test(await A.getAttribute('#mimg', 'src')), 'mapa da cidade carregou');
  ok(await A.isVisible('.zchip.on'), 'chip do mapa aparece');
  await A.click('[data-act="tnew"]'); await A.waitForTimeout(200);
  await A.fill('#t-name', 'Abel'); await A.click('#t-cols [data-col="#6fa8dc"]');
  await A.click('.sheet [data-close]'); await A.waitForTimeout(500);
  ok((await A.locator('.tok').count())===1 && await A.isVisible('.tok .tb'), 'peça criada');
  await shot(A, '3-peca');
  const p0 = await tokXY(A, 'abel');
  const box = await A.locator('.tok .tb').first().boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await A.mouse.move(cx, cy); await A.mouse.down();
  for (let i = 1; i <= 8; i++) await A.mouse.move(cx + i * 10, cy + i * 6);
  await A.mouse.up(); await A.waitForTimeout(600);
  const p1 = await tokXY(A, 'abel');
  ok(p1 && (p1[0] !== p0[0] || p1[1] !== p0[1]), 'peça andou ' + JSON.stringify(p0) + ' -> ' + JSON.stringify(p1));
  const dbTok = await A.evaluate(() => Object.values(JSON.parse(localStorage.getItem('stub:mesa_tokens') || '{}')));
  ok(dbTok.length === 1 && dbTok[0].data.name === 'Abel' && dbTok[0].data.x === p1[0] && dbTok[0].data.y === p1[1], 'banco guardou a peça na posição nova');
  const dbMap = await A.evaluate(() => Object.values(JSON.parse(localStorage.getItem('stub:mesa_maps') || '{}')));
  ok(dbMap.length === 1 && dbMap[0].data.img === 'pecas/mapa-jogadores-antes.webp', 'banco guardou o mapa');

  const B = await ctx.newPage(); watch(B, 'B');
  await B.goto(BASE + '#mesa'); await B.waitForTimeout(1200);
  ok(await B.evaluate(() => !document.querySelector('#ml').hidden), 'outra tela abre no mapa');
  const pb = await tokXY(B, 'abel');
  ok(pb && pb[0] === p1[0] && pb[1] === p1[1], 'outra tela vê a peça no mesmo lugar');
  await A.bringToFront();
  const box2 = await A.locator('.tok .tb').first().boundingBox();
  const cx2 = box2.x + box2.width / 2, cy2 = box2.y + box2.height / 2;
  await A.mouse.move(cx2, cy2); await A.mouse.down();
  for (let i = 1; i <= 6; i++) await A.mouse.move(cx2 - i * 12, cy2);
  await A.mouse.up(); await A.waitForTimeout(900);
  const p2 = await tokXY(A, 'abel'), pb2 = await tokXY(B, 'abel');
  ok(pb2 && pb2[0] === p2[0] && pb2[1] === p2[1], 'outra tela acompanha a peça andando ' + JSON.stringify(pb2));
  await shot(B, '4-outra-tela');

  // enviar imagem de mapa
  ok(await A.isVisible('[data-act="tedit"]'), 'peça arrastada fica selecionada');
  await A.click('[data-act="desel"]'); await A.waitForTimeout(200);
  await A.click('[data-act="maps"]'); await A.waitForTimeout(200);
  await A.fill('#m-new', 'Cine Rex por dentro');
  await A.setInputFiles('#m-file', path.join(ROOT, 'pecas/desenho-parede-do-fundo-da-cabine.webp'));
  await A.waitForTimeout(1500);
  const up = await A.evaluate(() => window.__uploads);
  ok(up.length === 1 && up[0].bucket === 'quadro' && /^teste1\//.test(up[0].path) && up[0].size > 1000, 'foto do mapa enviada ' + JSON.stringify(up[0] && { path: up[0].path, size: up[0].size, type: up[0].type }));
  ok(/stub-storage\.test/.test(await A.getAttribute('#mimg', 'src')), 'mapa novo aparece');
  ok((await A.locator('#zones .zchip:not(.add)').count()) === 2, 'dois mapas na barra');
  await A.waitForTimeout(600);
  ok((await B.locator('#zones .zchip:not(.add)').count()) === 2, 'outra tela recebeu o mapa novo');
  ok((await A.locator('.tok').count()) === 0, 'peça do outro mapa não aparece aqui');
  await A.click('#zones .zchip:not(.add) >> nth=0'); await A.waitForTimeout(500);
  ok((await A.locator('.tok').count()) === 1, 'volta pro mapa da cidade e a peça está lá');
  await shot(A, '5-dois-mapas');

  // imagem num cartão
  await A.click('#modes [data-mode="quadro"]'); await A.waitForTimeout(300);
  ok(await A.evaluate(() => document.querySelector('#ml').hidden && !document.querySelector('#cl').hidden), 'volta pro quadro');
  await A.click('[data-act="new"]'); await A.click('[data-new="pista"]'); await A.waitForTimeout(200);
  await A.fill('#e-title', 'Foto do ingresso');
  await A.setInputFiles('#e-img input[type=file]', path.join(ROOT, 'pecas/ingresso-sessao-das-oito.webp'));
  await A.waitForTimeout(1200);
  ok(await A.isVisible('#e-img .imgprev img'), 'prévia da foto na folha');
  await shot(A, '6-folha-cartao');
  await A.click('.sheet [data-close]'); await A.waitForTimeout(800);
  ok(await A.locator('.card .snap img').count() === 1, 'cartão mostra a foto');
  await shot(A, '7-cartao-foto');
  await B.click('#modes [data-mode="quadro"]'); await B.waitForTimeout(800);
  ok(await B.locator('.card .snap img').count() === 1, 'outra tela vê a foto no cartão');
  // colar link
  await A.click('.card'); await A.waitForTimeout(200);
  ok(await A.isVisible('[data-act="foto"]'), 'botão Foto no cartão selecionado');
  await A.click('[data-act="edit"]'); await A.click('#e-img [data-img="link"]');
  await A.fill('#e-img .imglink input', 'javascript:alert(1)'); await A.click('#e-img [data-img="ok"]');
  ok((await A.textContent('#e-img .imgmsg')).includes('não serve'), 'link ruim é recusado');
  await A.fill('#e-img .imglink input', 'pecas/cartaz-chuva-de-prata.webp'); await A.click('#e-img [data-img="ok"]');
  await A.waitForTimeout(400);
  ok(/cartaz-chuva/.test(await A.getAttribute('.card .snap img', 'src')), 'link de imagem do site funciona');
  await A.click('#e-img [data-img="rm"]'); await A.waitForTimeout(500);
  await A.click('.sheet [data-close]'); await A.waitForTimeout(800);
  ok(await A.locator('.card .snap').count() === 0, 'tirar a foto funciona');
  ok(await B.locator('.card .snap').count() === 0, 'outra tela também tirou a foto');
  await ctx.close();

  /* ---------- sem as tabelas novas: o quadro continua ---------- */
  const c2 = await ctxNew(b, { noMap: true });
  const C = await c2.newPage(); watch(C, 'C');
  await C.goto(BASE + '#mesa');
  await C.fill('#s-name', 'Rita'); await C.fill('#s-code', 'mesa2'); await C.click('#s-go');
  await C.waitForTimeout(800);
  ok(/ao vivo/.test(await C.textContent('#bMode')), 'quadro funciona sem as tabelas do mapa');
  await C.click('#modes [data-mode="mapa"]'); await C.waitForTimeout(500);
  ok((await C.textContent('#liveNote')).includes('sql/quadro-mapa.sql'), 'avisa que falta o SQL');
  await shot(C, '8-sem-sql');
  await C.click('#modes [data-mode="quadro"]'); await C.click('[data-act="new"]'); await C.click('[data-new="pista"]');
  await C.fill('#e-title', 'Ainda funciona'); await C.click('.sheet [data-close]'); await C.waitForTimeout(500);
  const cards = await C.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('stub:mesa_cards') || '{}')).length);
  ok(cards === 1, 'cartão salvo mesmo sem o mapa');
  await c2.close();

  /* ---------- quadro pessoal: mapa salvo no aparelho ---------- */
  const c3 = await ctxNew(b);
  const D = await c3.newPage(); watch(D, 'D');
  await D.goto(BASE);
  await D.click('#pNew'); await D.fill('#n-char', 'Thomas'); await D.click('#n-go'); await D.waitForTimeout(600);
  await D.click('#modes [data-mode="mapa"]'); await D.click('[data-act="maps"]'); await D.click('[data-madd="cidade"]'); await D.waitForTimeout(800);
  await D.click('[data-act="tnew"]'); await D.fill('#t-name', 'Thomas'); await D.click('.sheet [data-close]'); await D.waitForTimeout(500);
  await D.reload(); await D.waitForTimeout(1200);
  ok(await D.evaluate(() => !document.querySelector('#ml').hidden), 'quadro pessoal reabre no mapa');
  ok((await D.locator('.tok').count()) === 1, 'peça continua lá depois de recarregar');
  await D.click('.tok .tb', { force: true }); await D.waitForTimeout(200);
  await D.click('[data-act="tdel"]'); await D.waitForTimeout(200);
  ok((await D.locator('.tok').count()) === 0, 'tirar peça');
  await D.click('#toast button'); await D.waitForTimeout(300);
  ok((await D.locator('.tok').count()) === 1, 'desfazer devolve a peça');
  await shot(D, '9-pessoal');
  await c3.close();

  /* ---------- duas mesas (presencial e online): cada uma com o seu mapa e as suas peças ---------- */
  const c4 = await ctxNew(b);
  const E = await c4.newPage(); watch(E, 'E');
  await E.goto(BASE + '#mesa/presencial'); await E.waitForTimeout(600);
  ok((await E.inputValue('#s-code')) === 'presencial', 'link da mesa presencial já traz o código');
  await E.fill('#s-name', 'Mili'); await E.click('#s-go'); await E.waitForTimeout(900);
  ok((await E.textContent('#bName')) === 'Mesa presencial', 'topo mostra Mesa presencial');
  await E.click('#modes [data-mode="mapa"]'); await E.click('[data-act="maps"]');
  ok(await E.isVisible('[data-madd="cidade2"]'), 'segundo mapa pronto aparece na folha');
  await E.click('[data-madd="cidade"]'); await E.waitForTimeout(900);
  await E.click('[data-act="tnew"]'); await E.fill('#t-name', 'Abel'); await E.click('.sheet [data-close]'); await E.waitForTimeout(500);
  ok((await E.locator('.tok').count()) === 1, 'mesa presencial tem a peça do Abel');
  await E.evaluate(() => { location.hash = 'mesa/online'; }); await E.waitForTimeout(1200);
  ok((await E.textContent('#bName')) === 'Mesa online', 'trocar o link troca pra Mesa online');
  await E.click('#modes [data-mode="mapa"]').catch(() => {}); await E.waitForTimeout(400);
  ok((await E.locator('.tok').count()) === 0, 'mesa online não vê a peça da presencial');
  ok((await E.textContent('#liveNote')).includes('Nenhum mapa'), 'mesa online começa sem mapa');
  await E.click('[data-act="maps"]'); await E.click('[data-madd="cidade2"]'); await E.waitForTimeout(900);
  await E.click('[data-act="tnew"]'); await E.fill('#t-name', 'Thomas'); await E.click('.sheet [data-close]'); await E.waitForTimeout(500);
  const roomsTok = await E.evaluate(() => Object.values(JSON.parse(localStorage.getItem('stub:mesa_tokens') || '{}')).map(r => r.room + ':' + r.data.name).sort());
  ok(JSON.stringify(roomsTok) === JSON.stringify(['online:Thomas', 'presencial:Abel']), 'banco guarda cada peça na sua sala ' + JSON.stringify(roomsTok));
  await E.evaluate(() => { location.hash = 'mesa/presencial'; }); await E.waitForTimeout(1200);
  ok((await E.textContent('#bName')) === 'Mesa presencial' && (await E.locator('.tok').count()) === 1, 'volta pra presencial e a peça do Abel está lá');
  ok(/mapa-jogadores-antes/.test(await E.getAttribute('#mimg', 'src')), 'presencial mostra o mapa da cidade');
  await E.reload(); await E.waitForTimeout(1500);
  ok((await E.textContent('#bName')) === 'Mesa presencial', 'recarregar fica na mesma mesa');
  await shot(E, '10-duas-mesas');
  /* botões das duas mesas na tela inicial e atalhos na folha de entrada */
  await E.goto(BASE + '#'); await E.waitForTimeout(500);
  await E.evaluate(() => { location.hash = ''; }); await E.waitForTimeout(500);
  ok(await E.isVisible('#tRooms'), 'tela inicial mostra Mesa presencial e Mesa online');
  await E.click('#tRooms [data-room="online"]'); await E.waitForTimeout(1200);
  ok((await E.textContent('#bName')) === 'Mesa online', 'botão da tela inicial abre a mesa online');
  await c4.close();
  await b.close();
  console.log(fails ? fails + ' FALHAS' : 'TUDO PASSOU');
  process.exit(fails ? 1 : 0);
})();
