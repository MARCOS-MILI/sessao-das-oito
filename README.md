# Sessão das Oito

Quadro de investigação da mesa de RPG (Coxilha Seca, novembro de 1978).

- `index.html`: o site inteiro, num arquivo só.
- `supabase.js`: biblioteca do Supabase (versão 2.119.0), usada só no quadro da mesa ao vivo.

O quadro do mestre abre com senha e fica só no aparelho. O quadro da mesa guarda os cartões e os fios
no Supabase (tabelas `mesa_cards` e `mesa_links`), e cada mesa usa um código.
A chave que está no `index.html` é a `publishable`, que pode ficar pública. Nunca coloque a chave `secret` aqui.
