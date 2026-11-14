-- Quadro da mesa: mapas, peças e fotos.
-- Roda uma vez no SQL Editor do Supabase (depois do mesa-banco.sql, que o Supabase atual já tem).
-- Pode rodar de novo sem estragar nada: não apaga nenhuma linha nem nenhuma foto.
--
-- Como funciona:
--  * mesa_maps: os mapas de cada mesa (nome e link da imagem).
--  * mesa_tokens: as peças em cima do mapa (nome, cor, foto e posição).
--  * As duas seguem o mesmo jeito do quadro: {room, id, data}, com "room" sendo o código da mesa.
--  * Fotos enviadas pelo site (cartões, peças e mapas) vão pro balde "quadro" do Storage.
--    O balde é público pra leitura: quem tem o link vê a foto. Enviar é liberado; apagar e listar, não.

create table if not exists public.mesa_maps (
  room text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (room, id)
);

create table if not exists public.mesa_tokens (
  room text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (room, id)
);

alter table public.mesa_maps enable row level security;
alter table public.mesa_tokens enable row level security;

grant select, insert, update, delete on public.mesa_maps, public.mesa_tokens to anon, authenticated;

drop policy if exists mesa_maps_tudo on public.mesa_maps;
create policy mesa_maps_tudo on public.mesa_maps for all to anon, authenticated using (true) with check (true);

drop policy if exists mesa_tokens_tudo on public.mesa_tokens;
create policy mesa_tokens_tudo on public.mesa_tokens for all to anon, authenticated using (true) with check (true);

-- tempo real (a peça andando aparece na tela dos outros)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mesa_maps') then
    alter publication supabase_realtime add table public.mesa_maps;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mesa_tokens') then
    alter publication supabase_realtime add table public.mesa_tokens;
  end if;
end $$;

-- balde das fotos: público pra ver, até 3 MB por foto, só imagem
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quadro', 'quadro', true, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- quem usa a chave publishable pode enviar foto pro balde "quadro" (e só pra ele)
drop policy if exists quadro_envia_foto on storage.objects;
create policy quadro_envia_foto on storage.objects for insert to anon, authenticated with check (bucket_id = 'quadro');
