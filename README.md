# Sessão das Oito

Quadro de investigação da mesa de RPG (Coxilha Seca, novembro de 1978).

- `index.html`: o quadro (mesa ao vivo, quadro do mestre e quadros dos investigadores), num arquivo só.
- `ficha.html`: fichas dos jogadores. `terminal.html`: terminal de cena. `teste.html`: diagnóstico da conexão.
- `pecas/`: imagens que vão pros jogadores (cartazes, ingresso, caderno, etiquetas, mapas dos jogadores).
- `supabase.js`: biblioteca do Supabase (versão 2.119.0), usada pelo quadro da mesa, pela ficha e pelo terminal.
- `comum/config.js`: endereço e chave do Supabase, num lugar só pra todas as páginas.
- `sql/`: o que roda no SQL Editor do Supabase (`ficha-banco.sql`, `terminal-banco.sql`, `mesa-banco.sql`, a cópia de segurança do quadro da mesa, e `quadro-mapa.sql`, que liga o mapa e as fotos).
- `jogos/`: minigames (rádio, Morse e projetor). Jogadores abrem `jogos/`; o mestre configura e libera em `jogos/?mestre`.
- `comum/jogos.js` e `comum/jogos.css`: a base dos minigames (banco, Morse, som, aviso e o PD que sai da ficha).
- `testes/`: teste do quadro com um Supabase de mentira (`node testes/quadro-mapa.test.js` e `node testes/jogos.test.js`, com o site rodando em `localhost:8802`).

## Mapa e fotos no quadro

No alto do quadro tem a chave **Quadro | Mapa**. No mapa dá pra pôr o mapa da cidade ou qualquer outro (foto enviada
ou link de imagem) e pôr peças com nome, cor e foto, que se arrastam. Os cartões também aceitam foto.
No quadro da mesa ao vivo, mapas e peças aparecem pra todo mundo. Pra isso funcionar, rodar uma vez
`sql/quadro-mapa.sql` no SQL Editor do Supabase (cria as tabelas `mesa_maps` e `mesa_tokens` e o balde de fotos `quadro`).
Sem ele, o quadro continua funcionando e o mapa avisa o que falta.

O quadro do mestre abre com senha e fica só no aparelho. O quadro da mesa guarda os cartões e os fios
no Supabase (tabelas `mesa_cards` e `mesa_links`), e cada mesa usa um código.

Duas mesas (presencial e online): cada código de mesa tem o seu quadro, o seu mapa e as suas peças. Link direto:
`#mesa/presencial` e `#mesa/online` (qualquer outro código também serve, por exemplo `#mesa/teste`). O link guarda o código
no aparelho e abre a mesa; trocar o final do endereço troca de mesa. Na tela inicial e no menu "Trocar nome ou código" há
atalhos pras duas.
A chave que está no `index.html` é a `publishable`, que pode ficar pública. Nunca coloque a chave `secret` aqui.

## Fichas dos jogadores (`ficha.html`)

Ficha automática de Ordem Paranormal RPG 2 (playtest beta) pra Sessão das Oito.

- Cada jogador abre o **link pessoal** (`ficha.html?j=CÓDIGO`) e edita só a ficha dele.
- O mestre abre `ficha.html?mestre`, entra com a senha e vê todas as fichas, o que mudou, e cria os links.
- O site fala com o Supabase só por funções SQL (`sql/ficha-banco.sql`). As tabelas ficam fechadas pro público (RLS ligado, sem política).
- O código do site não guarda senha nem história de personagem. A senha do mestre e as fichas-modelo entram direto no Supabase, pelo SQL Editor.
- A tela do mestre atualiza sozinha a cada 8 segundos, a do jogador a cada 10. Com a aba escondida, não consulta o banco.

## Terminal (`terminal.html`)

Computador de cena que abre a sessão: papel de impressora, senha e arquivos que o mestre vai liberando durante o jogo.

- Os jogadores abrem `terminal.html`, digitam a senha do terminal (que eles descobrem na sessão) e usam os comandos `ajuda`, `arquivos`, `ler`, `mensagens`.
- O mestre abre `terminal.html?mestre` com a mesma senha das fichas. Lá define a senha do terminal, cria arquivos e mensagens, libera ou esconde cada um e manda transmissões na hora. A tela dos jogadores atualiza sozinha em até 6 segundos e toca um bipe.
- O site fala com o Supabase só por funções SQL (`sql/terminal-banco.sql`, rodar depois do `ficha-banco.sql`). As tabelas ficam fechadas pro público.
- O código do site não guarda a senha do terminal nem o texto dos arquivos. Tudo isso fica só no banco.
- Os nomes de cena (empresa, máquina, local) ficam no começo do script, em `EMPRESA`, `MAQUINA` e `LOCAL`.

## Peças dos jogadores (`pecas/`)

Imagens que podem ir pra mesa. O Escudo do Mestre copia os links daqui (aba Links), pra nenhum link mandado aos
jogadores mostrar o endereço do Escudo. Peça nova pros jogadores entra aqui e em `img/pecas/` do Escudo.
Mapas dos jogadores ficam como `mapa-jogadores-antes.webp` e `mapa-jogadores-depois.webp`.

## Minigames (`jogos/`)

- **O rádio:** gira a sintonia no meio do chiado até achar a transmissão (com assobio que fica grave perto da estação).
- **O Morse:** bloco com botões de ponto e traço; as letras se montam sozinhas. Dá pra ouvir a transmissão limpa e conferir.
- **O projetor:** contagem de cabeça de rolo (números que faltam viram emenda) e um cadeado que o mestre mostra quando quiser.
- Errar no Morse ou no cadeado tira 1 PD da ficha que está aberta neste celular (com Desfazer). Fica no registro da ficha.
- O mestre configura e libera cada jogo em `jogos/?mestre` (senha das fichas). A mensagem, os números e o código
  ficam só no banco: rodar uma vez `sql/jogos-banco.sql` no SQL Editor do Supabase.
