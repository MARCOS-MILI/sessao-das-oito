# Notas pro Claude (Sessão das Oito, site dos jogadores)

Site que os jogadores abrem: quadro de investigação (`index.html`), fichas (`ficha.html`), terminal (`terminal.html`)
e as peças (`pecas/`). HTML, CSS e JS puros, sem build. GitHub Pages a partir da `main`, pasta raiz.
Banco: Supabase (plano grátis). Endereço e chave `publishable` só em `comum/config.js`. Ficha e terminal falam
só por funções SQL; o quadro da mesa grava direto em `mesa_cards`, `mesa_links`, `mesa_maps` e `mesa_tokens`
(ver `sql/mesa-banco.sql` e `sql/quadro-mapa.sql`). Fotos enviadas vão pro balde público `quadro` do Storage.

## Decidido pelo Marcos
- 14/11/2026: minigames ficam pra depois. Primeiro organizar o que já existe.
- Quando vierem, cada minigame entra em `jogos/<nome>/` e usa `comum/`. A resposta de enigma nunca fica
  escrita no código (fica no banco ou em hash), porque o site é público.

## Como trabalhar com o Marcos
- Ele escreve por voz no celular, em português do Brasil informal. Interpretar a intenção, não ler ao pé da letra.
- Prefere que o Claude execute em vez de perguntar muito. Perguntar só o que não dá pra desfazer.
- Respostas curtas, que leiam bem na tela do celular.
- Textos do site em português do Brasil natural: sem travessão, sem formalidade exagerada.

## Regras do repositório
- **Os jogadores abrem este site.** Nada de spoiler da história em texto aberto: nem em código, nem em comentário,
  nem em README, nem neste arquivo. O quadro do mestre só existe criptografado (`MASTER_ENC` no `index.html`).
  A fonte do quadro e o contexto da mesa ficam fora deste repositório.
- Nunca escrever senha (quadro, fichas, terminal) nem a chave `secret` do Supabase em arquivo nenhum.
- Não mudar de lugar `index.html`, `ficha.html` e `terminal.html`: os jogadores já têm links salvos
  (por exemplo `ficha.html?j=CÓDIGO`). Coisa nova entra em pasta nova.
- Testar no celular (largura 390 px) antes de subir: `python3 -m http.server 8802` na pasta e abrir no Playwright.
  O quadro tem teste pronto: `node testes/quadro-mapa.test.js` (usa `testes/stub-supabase.js` no lugar do Supabase,
  com banco no localStorage e tempo real entre abas). Se mexer no quadro, rodar e ampliar esse teste.
- O site irmão, só do mestre, é o repositório `MARCOS-MILI/ESCUDO-DO-MESTRE`.

## Quadro do mestre (atualizar)
Editar a fonte (fora deste repositório), subir o `ver`, criptografar o JSON com a senha do Marcos
(PBKDF2 SHA-256, 150000 iterações, AES-GCM, sal 16 bytes + iv 12 bytes + texto, tudo em base64)
e trocar `MASTER_ENC` e `MASTER_META` no `index.html`. Sem a senha não dá.
