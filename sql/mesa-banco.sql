-- Quadro da mesa ao vivo (index.html): tabelas, acesso e tempo real.
-- Cópia de segurança. O Supabase atual já tem tudo isto (o quadro da mesa funciona), então não precisa rodar agora.
-- Serve pra recriar num projeto novo do Supabase. Pode rodar de novo sem estragar nada: não apaga nenhuma linha.
--
-- Como funciona:
--  * Cada cartão e cada fio é uma linha, no formato {room, id, data}. "room" é o código da mesa.
--  * O site lê e grava direto nas tabelas, com a chave publishable (sem senha).
--  * Por isso, quem tem a chave e o código de uma mesa consegue mexer nela. O código da mesa é a proteção.
--  * O tempo real (cartão aparecendo na hora na tela dos outros) vem da publicação supabase_realtime.

create table if not exists public.mesa_cards (
  room text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (room, id)
);

create table if not exists public.mesa_links (
  room text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (room, id)
);

alter table public.mesa_cards enable row level security;
alter table public.mesa_links enable row level security;

grant select, insert, update, delete on public.mesa_cards, public.mesa_links to anon, authenticated;

-- uma política por tabela: quem usa a chave publishable lê e grava
drop policy if exists mesa_cards_tudo on public.mesa_cards;
create policy mesa_cards_tudo on public.mesa_cards for all to anon, authenticated using (true) with check (true);

drop policy if exists mesa_links_tudo on public.mesa_links;
create policy mesa_links_tudo on public.mesa_links for all to anon, authenticated using (true) with check (true);

-- liga o tempo real nas duas tabelas (só adiciona se ainda não estiver ligada)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mesa_cards') then
    alter publication supabase_realtime add table public.mesa_cards;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mesa_links') then
    alter publication supabase_realtime add table public.mesa_links;
  end if;
end $$;
