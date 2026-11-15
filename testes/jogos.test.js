/* Teste dos minigames (rádio, Morse e projetor) contra um Supabase de mentira (stub-supabase.js).
   Como rodar: na raiz do repositório, "python3 -m http.server 8802" e, em outro terminal,
   "node testes/jogos.test.js". Com SHOTS=pasta, salva as telas lá.
   Mensagem e código aqui são inventados (o repositório é público). */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const STUB = fs.readFileSync(path.join(__dirname, 'stub-supabase.js'), 'utf8');
const BASE = process.env.BASE || 'http://localhost:8802/';
const MSG = 'TESTE DO RADIO', COD = '135', MOSTRA_FORA = [7, 4, 2];
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const shot = (p, n) => process.env.SHOTS ? p.screenshot({ path: path.join(process.env.SHOTS, 'j-' + n + '.png') }) : null;

async function novoCtx(b, o = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  await ctx.route('**/supabase.js', r => r.fulfill({ contentType: 'application/javascript', body: STUB }));
  await ctx.addInitScript(o => {
    if (o.noJogos) window.__stubNoJogos = true;
    if (o.seed && !localStorage.getItem('stub:seeded')) {
      localStorage.setItem('stub:seeded', '1');
      Object.keys(o.seed).forEach(k => localStorage.setItem(k, o.seed[k]));
    }
  }, o);
  return ctx;
}
function olha(p, tag) {
  p.on('pageerror', e => { console.log('PAGEERROR ' + tag + ': ' + e.message); fails++; });
  p.on('console', m => { if (m.type() === 'error') console.log('console ' + tag + ': ' + m.text().slice(0, 160)); });
}
const pd = p => p.evaluate(() => JSON.parse(localStorage.getItem('stub:fichas') || '{}').tokA.pd);
async function bate(p, txt) {
  const T = await p.evaluate(() => window.J.TAB);
  for (const ch of txt) {
    if (ch === ' ') { await p.click('#espaco'); continue; }
    for (const s of T[ch]) await p.click(s === '.' ? '[data-s="."]' : '[data-s="-"]');
    await p.click('#letra');
  }
}

(async () => {
  const b = await chromium.launch();
  const fichas = JSON.stringify({ tokA: { nome: 'Abel', pd: 12, pdMax: 12, log: [] } });

  /* ---------- o mestre configura ---------- */
  const ctx = await novoCtx(b, { seed: { 'stub:fichas': fichas } });
  const M = await ctx.newPage(); olha(M, 'mestre');
  await M.goto(BASE + 'jogos/?mestre');
  await M.fill('#pw', 'errada'); await M.click('#go'); await M.waitForTimeout(300);
  ok((await M.textContent('#lerr')).includes('Senha errada'), 'senha errada recusada');
  await M.fill('#pw', 'teste'); await M.click('#go'); await M.waitForTimeout(400);
  ok(await M.isVisible('#m-txt'), 'painel do mestre abriu');
  await shot(M, '1-painel');
  await M.fill('#m-txt', 'Teste do rádio');
  ok(/letras/.test(await M.textContent('#m-info')), 'mostra quanto tempo a mensagem toca');
  await M.click('#m-salvar'); await M.waitForTimeout(300);
  await M.fill('#r-f', '1250'); await M.click('#r-salvar'); await M.waitForTimeout(300);
  for (const n of MOSTRA_FORA) await M.click('#p-num [data-n="' + n + '"]');
  await M.click('#p-cad'); await M.fill('#p-tit', 'O cofre de teste'); await M.fill('#p-cod', COD); await M.fill('#p-den', 'Dentro tem um bilhete de teste.');
  await M.fill('#p-img', 'pecas/ingresso-sessao-das-oito.webp');
  await M.click('#p-salvar'); await M.waitForTimeout(300);
  for (const id of ['radio', 'morse', 'projetor']) { await M.click('[data-tog="' + id + '"]'); await M.waitForTimeout(250); }
  const db = await M.evaluate(() => JSON.parse(localStorage.getItem('stub:jogos')));
  ok(db.morse.segredo.texto === MSG && db.morse.publico.morse && !/[A-Z]/.test(db.morse.publico.morse), 'mensagem guardada em segredo; público só pontos e traços');
  ok(db.radio.publico.freq === 1250 && db.radio.publico.morse === db.morse.publico.morse, 'rádio com frequência e o mesmo Morse');
  ok(JSON.stringify(db.projetor.publico.mostra) === '[8,6,5,3]' && db.projetor.publico.cadeado && db.projetor.segredo.codigo === COD, 'projetor: números, cadeado e código');
  ok(db.radio.liberado && db.morse.liberado && db.projetor.liberado, 'três jogos no ar');
  ok(await M.evaluate(() => localStorage.getItem('sdo_jogos_mestre')) === '1', 'aparelho marcado como do mestre');
  await ctx.close();

  /* ---------- o jogador (com ficha neste celular) ---------- */
  const c2 = await novoCtx(b, { seed: { 'stub:fichas': fichas, 'stub:jogos': JSON.stringify(db), sdo_tok: 'tokA' } });
  const P = await c2.newPage(); olha(P, 'jogador');
  await P.goto(BASE + 'jogos/'); await P.waitForTimeout(600);
  ok((await P.locator('.jogo').count()) === 3, 'página de jogos mostra os três');
  ok((await P.textContent('#pd')).includes('Abel'), 'avisa que o PD sai da ficha do Abel');
  await shot(P, '2-entrada');

  // rádio
  await P.goto(BASE + 'jogos/radio/'); await P.waitForTimeout(500);
  await P.click('#liga');
  await P.focus('#dial');
  const f0 = await P.evaluate(() => +document.querySelector('#dial').getAttribute('aria-valuenow'));
  const passos = Math.round((1250 - f0) / 10);
  for (let i = 0; i < Math.abs(passos); i++) await P.keyboard.press((passos > 0 ? 'Shift+ArrowRight' : 'Shift+ArrowLeft'));
  await P.waitForTimeout(300);
  const f1 = await P.evaluate(() => +document.querySelector('#dial').getAttribute('aria-valuenow'));
  for (let i = 0; i < Math.abs(1250 - f1); i++) await P.keyboard.press(1250 > f1 ? 'ArrowRight' : 'ArrowLeft');
  await P.waitForTimeout(1900);
  ok((await P.textContent('#estado')).includes('Sintonizado'), 'rádio sintoniza em 1250');
  ok(await P.isVisible('#segue a'), 'aparece o botão de anotar o Morse');
  await shot(P, '3-radio');
  for (let i = 0; i < 40; i++) await P.keyboard.press('Shift+ArrowLeft');
  await P.waitForTimeout(300);
  ok(!(await P.textContent('#estado')).includes('Sintonizado'), 'longe da estação perde o sinal');

  // Morse
  await P.goto(BASE + 'jogos/morse/'); await P.waitForTimeout(600);
  ok(await P.isVisible('#ouvir'), 'transmissão liberada pra ouvir');
  await P.click('#ouvir'); await P.waitForTimeout(1200);
  const w = await P.evaluate(() => parseFloat(document.querySelector('#barra').style.width));
  ok(w > 0, 'barra anda enquanto toca (' + w.toFixed(1) + '%)');
  await P.click('#ouvir');
  await bate(P, 'TESTE DO RAPIO');
  ok((await P.textContent('#papel')).includes('TESTE DO RAPIO'), 'as letras se montam sozinhas');
  await P.click('#conferir'); await P.waitForTimeout(800);
  ok((await pd(P)) === 11, 'errou: PD 12 → 11 na ficha');
  ok(await P.locator('.papel .w-no').count() === 1 && await P.locator('.papel .w-ok').count() === 2, 'marca a palavra errada');
  const log = await P.evaluate(() => JSON.parse(localStorage.getItem('stub:fichas')).tokA.log);
  ok(log.length === 1 && log[0].l === 'PD (Morse)' && log[0].de === 12 && log[0].para === 11, 'registro aparece pro mestre na ficha');
  await shot(P, '4-morse-errou');
  await P.click('#toast button'); await P.waitForTimeout(500);
  ok((await pd(P)) === 12, 'desfazer devolve o PD');
  ok((await P.evaluate(() => JSON.parse(localStorage.getItem('stub:fichas')).tokA.log.length)) === 0, 'desfazer tira o registro');
  await P.click('#apaga'); await P.click('#apaga'); await P.click('#apaga');
  await bate(P, 'DIO');
  await P.click('#conferir'); await P.waitForTimeout(600);
  ok(await P.isVisible('.telegrama'), 'acertou: telegrama com a mensagem');
  ok((await pd(P)) === 12, 'acertar não tira PD');
  await shot(P, '5-morse-certo');

  // projetor
  await P.goto(BASE + 'jogos/projetor/'); await P.waitForTimeout(600);
  ok(!(await P.isDisabled('#liga')), 'projetor liberado');
  await P.click('#liga'); await P.waitForTimeout(900);
  const px = () => P.evaluate(() => { const c = document.querySelector('#cv'), d = c.getContext('2d').getImageData(400, 300, 1, 1).data; return d[0] + d[1] + d[2]; });
  const a1 = await px(); await P.waitForTimeout(1100); const a2 = await px();
  ok(a1 !== a2 || a1 > 0, 'a contagem roda na tela');
  await shot(P, '6-projetor');
  ok(await P.isVisible('#cofre') && (await P.locator('.dig').count()) === 3 && (await P.textContent('#cofre-t')) === 'O cofre de teste', 'cadeado de 3 números, com o nome que o mestre deu');
  await P.click('#abrir'); await P.waitForTimeout(800);
  ok((await pd(P)) === 11, 'cadeado errado tira 1 PD');
  await P.waitForTimeout(900);
  for (let i = 0; i < 3; i++) for (let k = 0; k < +COD[i]; k++) await P.click('[data-r="' + i + '"][data-d="1"]');
  await P.click('#abrir'); await P.waitForTimeout(600);
  ok((await P.textContent('#dentro')).includes('bilhete de teste') && await P.isVisible('#dentro img'), 'código certo abre e mostra o que tem dentro');
  ok((await pd(P)) === 11, 'abrir não tira PD');
  await shot(P, '7-cadeado');
  await c2.close();

  /* ---------- sem ficha no celular, e fora do ar ---------- */
  const db2 = JSON.parse(JSON.stringify(db)); db2.projetor.liberado = false;
  const c3 = await novoCtx(b, { seed: { 'stub:jogos': JSON.stringify(db2) } });
  const Q = await c3.newPage(); olha(Q, 'sem ficha');
  await Q.goto(BASE + 'jogos/'); await Q.waitForTimeout(500);
  ok((await Q.locator('.jogo').count()) === 2, 'jogo fora do ar some da lista');
  await Q.goto(BASE + 'jogos/projetor/'); await Q.waitForTimeout(500);
  ok(await Q.isDisabled('#liga') && !(await Q.isVisible('#cofre')), 'projetor fora do ar não liga');
  await Q.goto(BASE + 'jogos/morse/'); await Q.waitForTimeout(500);
  await bate(Q, 'E'); await Q.click('#conferir'); await Q.waitForTimeout(500);
  ok((await Q.textContent('#toast')).includes('Tira na sua ficha'), 'sem ficha: avisa pra tirar na mão');
  await c3.close();

  /* ---------- sem o SQL ---------- */
  const c4 = await novoCtx(b, { noJogos: true });
  const R = await c4.newPage(); olha(R, 'sem sql');
  await R.goto(BASE + 'jogos/'); await R.waitForTimeout(500);
  ok((await R.textContent('#app')).includes('jogos-banco.sql'), 'sem o SQL avisa o que falta');
  await c4.close();

  await b.close();
  console.log(fails ? fails + ' FALHAS' : 'TUDO PASSOU');
  process.exit(fails ? 1 : 0);
})();
