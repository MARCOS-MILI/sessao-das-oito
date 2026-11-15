/* Base dos minigames (pasta jogos/): banco, Morse, som, aviso e o PD que sai da ficha.
   Precisa de comum/config.js e supabase.js carregados antes. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  /* raiz do site, tirada do endereço deste arquivo (comum/jogos.js) */
  var RAIZ = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/comum\/jogos\.js(\?.*)?$/, '') : '../'; })();
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ---------- banco ---------- */
  var sb = null;
  function client() {
    if (!sb) {
      var c = window.SB_CONFIG || {};
      if (!window.supabase || !window.supabase.createClient || !c.url) throw new Error('sem_banco');
      sb = window.supabase.createClient(c.url, c.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    }
    return sb;
  }
  async function rpc(name, args) {
    var r = await client().rpc(name, args || {});
    if (r && r.error) { var e = new Error(r.error.message || 'erro'); e.msg = String(r.error.message || ''); e.code = r.error.code; throw e; }
    return r.data;
  }
  async function estado() { return (await rpc('sdo_j_ler')) || {}; }
  function erroTxt(e) {
    var m = String((e && (e.msg || e.message)) || '');
    if (/sem_banco/.test(m)) return 'Não consegui carregar a conexão (supabase.js).';
    if (/sdo_j_|function|PGRST202|schema cache/i.test(m)) return 'Os minigames ainda não foram ligados no Supabase. O mestre precisa rodar o sql/jogos-banco.sql.';
    return 'Sem conexão com a central. Confira a internet e tente de novo.';
  }

  /* ---------- envio de arquivo (áudio e foto do mestre) ---------- */
  async function enviar(file, pasta) {
    var nome = String(file.name || '').toLowerCase();
    var ext = (nome.match(/\.([a-z0-9]{2,4})$/) || [])[1] || 'bin';
    var path = (pasta || 'mestre') + '/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    var st = client().storage.from('jogos');
    var r = await st.upload(path, file, { contentType: file.type || undefined, cacheControl: '31536000', upsert: false });
    if (r.error) throw r.error;
    return st.getPublicUrl(path).data.publicUrl;
  }
  function okUrl(u) {
    u = String(u == null ? '' : u).trim();
    if (/^https:\/\/[^\s"'<>\\]{4,480}$/.test(u)) return u;
    if (/^(\.\.\/)*pecas\/[a-z0-9-]{1,80}\.webp$/.test(u)) return u.replace(/^(\.\.\/)+/, '');
    return '';
  }
  /* endereço pra usar na tela: peça do site vira endereço completo */
  function src(u) { u = okUrl(u); return /^pecas\//.test(u) ? RAIZ + u : u; }

  /* ---------- Morse ---------- */
  var TAB = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
    N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.', '-': '-....-', ':': '---...', '=': '-...-', '"': '.-..-.'
  };
  var DE = {}; Object.keys(TAB).forEach(function (k) { DE[TAB[k]] = k; });
  function norm(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
      .replace(/[^A-Z0-9.,?!\/\-:="\s]/g, '').replace(/\s+/g, ' ').trim();
  }
  function codifica(t) {
    return norm(t).split(' ').filter(Boolean).map(function (w) {
      return Array.from(w).map(function (c) { return TAB[c] || ''; }).filter(Boolean).join(' ');
    }).filter(Boolean).join(' / ');
  }
  function decodifica(p) {
    return String(p || '').trim().split(/\s*\/\s*/).map(function (w) {
      return w.split(/\s+/).filter(Boolean).map(function (c) { return DE[c] || '?'; }).join('');
    }).join(' ');
  }
  /* só letras e números contam na hora de conferir */
  var soLetras = function (t) { return norm(t).replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); };
  function duracao(p, wpm) {
    var u = 1.2 / (wpm || 10), t = 0;
    String(p || '').trim().split(/\s*\/\s*/).forEach(function (w, wi) {
      if (wi) t += 7 * u;
      w.split(/\s+/).filter(Boolean).forEach(function (c, ci) {
        if (ci) t += 3 * u;
        Array.from(c).forEach(function (s, si) { if (si) t += u; t += (s === '-' ? 3 : 1) * u; });
      });
    });
    return t;
  }

  /* ---------- som ---------- */
  var ac = null;
  function audio() {
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (!ac) ac = new C();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  /* toca o Morse a partir de t0, no destino dado; devolve o fim e um jeito de parar */
  function tocaMorse(ctx, p, wpm, dest, t0, hz) {
    var u = 1.2 / (wpm || 10), R = 0.006;
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = hz || 750;
    g.gain.setValueAtTime(0, t0); osc.connect(g); g.connect(dest);
    var t = t0;
    String(p || '').trim().split(/\s*\/\s*/).forEach(function (w, wi) {
      if (wi) t += 7 * u;
      w.split(/\s+/).filter(Boolean).forEach(function (c, ci) {
        if (ci) t += 3 * u;
        Array.from(c).forEach(function (s, si) {
          if (si) t += u;
          var d = (s === '-' ? 3 : 1) * u;
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + R);
          g.gain.setValueAtTime(1, t + d - R); g.gain.linearRampToValueAtTime(0, t + d);
          t += d;
        });
      });
    });
    osc.start(t0); osc.stop(t + 0.05);
    return { fim: t, para: function () { try { osc.stop(); } catch (e) {} try { g.disconnect(); } catch (e) {} } };
  }
  /* chiado: ruído em laço */
  function ruido(ctx, seg) {
    var n = Math.floor(ctx.sampleRate * (seg || 2)), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
    return s;
  }
  function bipe(ctx, dest, t, hz, dur, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = hz || 1000; g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol || 0.5, t + 0.004); g.gain.setValueAtTime(vol || 0.5, t + (dur || 0.05) - 0.004);
    g.gain.linearRampToValueAtTime(0, t + (dur || 0.05));
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + (dur || 0.05) + 0.02);
  }

  /* ---------- aviso ---------- */
  var toastT = 0;
  function toast(msg, label, fn, ms) {
    var t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.innerHTML = '<span>' + esc(msg) + '</span>';
    if (label) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.onclick = function () { t.hidden = true; fn(); }; t.appendChild(b);
    }
    t.hidden = false; clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, ms || (label ? 7000 : 3500));
  }

  /* ---------- PD: errou, sai 1 da ficha de quem está jogando neste aparelho ---------- */
  var ehMestre = function () { return LS.get('sdo_jogos_mestre') === '1'; };
  var temFicha = function () { return !!LS.get('sdo_tok'); };
  async function nomeFicha() {
    var tok = LS.get('sdo_tok'); if (!tok) return '';
    try { var r = await rpc('sdo_ler', { p_token: tok }); return String((r && r.dados && r.dados.nome) || '').trim() || 'sua ficha'; }
    catch (e) { return ''; }
  }
  async function mudaPD(tok, delta, rotulo, tirarT) {
    var r = await rpc('sdo_ler', { p_token: tok }), d = (r && r.dados) || {};
    var de = Number.isFinite(+d.pd) ? +d.pd : 0;
    var max = Number.isFinite(+d.pdMax) ? +d.pdMax : 99;
    var para = Math.max(0, Math.min(max, de + delta)), now = Date.now();
    var log = (Array.isArray(d.log) ? d.log : []).filter(function (e) { return !(tirarT && e && e.t === tirarT && e.k === 'pd'); });
    if (!tirarT) log.push({ k: 'pd', l: 'PD (' + rotulo + ')', de: de, para: para, t: now, por: 'jogador' });
    await rpc('sdo_salvar', { p_token: tok, p_patch: { pd: para, log: log.slice(-60), atualizadoEm: now, atualizadoPor: 'jogador' } });
    return { nome: String(d.nome || '').trim(), de: de, para: para, t: now };
  }
  async function perde1PD(rotulo) {
    if (ehMestre()) { toast('Teste do mestre: errou, mas não tirei PD de ninguém.'); return { teste: true }; }
    var tok = LS.get('sdo_tok');
    if (!tok) { toast('Perdeu 1 PD. Tira na sua ficha.'); return { semFicha: true }; }
    try {
      var r = await mudaPD(tok, -1, rotulo);
      toast((r.nome || 'Sua ficha') + ': PD ' + r.de + ' → ' + r.para + '.', 'Desfazer', function () {
        mudaPD(tok, +1, rotulo, r.t).then(function () { toast('Devolvi o PD.'); }, function () { toast('Não consegui devolver. Arruma na ficha.'); });
      });
      return r;
    } catch (e) {
      toast('Perdeu 1 PD, mas não consegui mexer na ficha. Tira lá na mão.');
      return { erro: true };
    }
  }
  /* carimbo grande na tela */
  function carimbo(txt, cls) {
    var s = document.createElement('div');
    s.className = 'carimbo ' + (cls || ''); s.textContent = txt; s.setAttribute('aria-hidden', 'true');
    document.body.appendChild(s);
    setTimeout(function () { s.remove(); }, 1600);
  }
  /* linha que diz de onde sai o PD (fica no topo de cada jogo) */
  async function linhaPD(el) {
    if (!el) return;
    if (ehMestre()) { el.textContent = 'Aparelho do mestre: errar aqui não tira PD.'; return; }
    if (!temFicha()) { el.innerHTML = 'Errar custa 1 PD. Abra a sua ficha neste celular uma vez (pelo link do mestre) e eu tiro sozinho.'; return; }
    el.textContent = 'Errar custa 1 PD.';
    var n = await nomeFicha();
    if (n) el.textContent = 'Errar custa 1 PD, que sai da ficha de ' + n + '.';
  }

  window.J = {
    $: $, esc: esc, LS: LS, rpc: rpc, estado: estado, erroTxt: erroTxt, enviar: enviar, okUrl: okUrl, src: src,
    TAB: TAB, norm: norm, codifica: codifica, decodifica: decodifica, soLetras: soLetras, duracao: duracao,
    audio: audio, tocaMorse: tocaMorse, ruido: ruido, bipe: bipe,
    toast: toast, perde1PD: perde1PD, carimbo: carimbo, linhaPD: linhaPD, ehMestre: ehMestre, temFicha: temFicha
  };
})();
