# Sessão das Oito

Quadro de investigação da mesa de RPG (Coxilha Seca, novembro de 1978).

- `index.html`: o site inteiro, num arquivo só.
- `supabase.js`: biblioteca do Supabase (versão 2.119.0), usada só no quadro da mesa ao vivo.

O quadro do mestre abre com senha e fica só no aparelho. O quadro da mesa guarda os cartões e os fios
no Supabase (tabelas `mesa_cards` e `mesa_links`), e cada mesa usa um código.
A chave que está no `index.html` é a `publishable`, que pode ficar pública. Nunca coloque a chave `secret` aqui.

## Fichas dos jogadores (`ficha.html`)

Ficha automática de Ordem Paranormal RPG 2 (playtest beta) pra Sessão das Oito.

- Cada jogador abre o **link pessoal** (`ficha.html?j=CÓDIGO`) e edita só a ficha dele.
- O mestre abre `ficha.html?mestre`, entra com a senha e vê todas as fichas, o que mudou, e cria os links.
- O site fala com o Supabase só por funções SQL (`sql/ficha-banco.sql`). As tabelas ficam fechadas pro público (RLS ligado, sem política).
- O código do site não guarda senha nem história de personagem. A senha do mestre e as fichas-modelo entram direto no Supabase, pelo SQL Editor.
- A tela do mestre atualiza sozinha a cada 8 segundos, a do jogador a cada 10. Com a aba escondida, não consulta o banco.
