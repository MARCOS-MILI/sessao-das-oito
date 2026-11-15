-- Minigames (pasta jogos/): o que o mestre libera e as respostas.
-- Roda no SQL Editor do Supabase, DEPOIS do ficha-banco.sql (usa a mesma senha do mestre).
-- Pode rodar de novo sem estragar nada: não apaga a configuração que o mestre já salvou.
--
-- Como funciona:
--  * A tabela fica fechada pro público (RLS ligado e sem política). O site só fala com ela por funções.
--  * Cada jogo (radio, morse, projetor) tem uma parte pública, que só sai quando o jogo está liberado,
--    e uma parte secreta, que nunca sai pros jogadores (a mensagem escrita, o código do cadeado, o que tem dentro).
--  * O código do cadeado é conferido aqui no banco. Errou, espera 1 segundo.
--  * O mestre usa a senha dele (a mesma das fichas) pra configurar e liberar, em jogos/?mestre.
--  * As fotos e o áudio que o mestre envia vão pro balde público "jogos" do Storage.

create table if not exists public.sdo_jogos (
  id text primary key check (id in ('radio', 'morse', 'projetor')),
  liberado boolean not null default false,
  publico jsonb not null default '{}'::jsonb,
  segredo jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

insert into public.sdo_jogos (id) values ('radio'), ('morse'), ('projetor') on conflict (id) do nothing;

alter table public.sdo_jogos enable row level security;
revoke all on public.sdo_jogos from anon, authenticated;

-- jogadores: o que está liberado agora (só a parte pública)
create or replace function public.sdo_j_ler() returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(id,
    case when liberado then publico || jsonb_build_object('liberado', true)
         else jsonb_build_object('liberado', false) end), '{}'::jsonb)
  from public.sdo_jogos;
$$;

-- jogadores: tentar o cadeado do projetor
create or replace function public.sdo_j_cadeado(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.sdo_jogos;
begin
  select * into r from public.sdo_jogos where id = 'projetor';
  if not found or not r.liberado or coalesce(r.segredo->>'codigo', '') = '' then
    return jsonb_build_object('ok', false, 'fora', true);
  end if;
  if regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g') = regexp_replace(r.segredo->>'codigo', '\D', '', 'g') then
    return jsonb_build_object('ok', true,
      'texto', coalesce(r.segredo->>'dentro', ''),
      'img', coalesce(r.segredo->>'dentro_img', ''));
  end if;
  perform pg_sleep(1);
  return jsonb_build_object('ok', false);
end $$;

-- mestre: tudo, liberado ou não
create or replace function public.sdo_m_j_ler(p_senha text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.sdo_chk(p_senha);
  return (select coalesce(jsonb_object_agg(id, jsonb_build_object(
    'liberado', liberado, 'publico', publico, 'segredo', segredo, 'atualizado_em', atualizado_em)), '{}'::jsonb)
    from public.sdo_jogos);
end $$;

-- mestre: salvar um jogo (o que vier nulo fica como estava)
create or replace function public.sdo_m_j_salvar(
  p_senha text, p_id text, p_liberado boolean, p_publico jsonb, p_segredo jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.sdo_chk(p_senha);
  if p_id not in ('radio', 'morse', 'projetor') then raise exception 'jogo_invalido'; end if;
  if length(coalesce(p_publico::text, '')) > 20000 or length(coalesce(p_segredo::text, '')) > 20000 then
    raise exception 'grande_demais';
  end if;
  insert into public.sdo_jogos (id) values (p_id) on conflict (id) do nothing;
  update public.sdo_jogos set
    liberado = coalesce(p_liberado, liberado),
    publico = coalesce(p_publico, publico),
    segredo = coalesce(p_segredo, segredo),
    atualizado_em = now()
  where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.sdo_j_ler(), public.sdo_j_cadeado(text), public.sdo_m_j_ler(text),
  public.sdo_m_j_salvar(text, text, boolean, jsonb, jsonb) from public;
grant execute on function public.sdo_j_ler(), public.sdo_j_cadeado(text), public.sdo_m_j_ler(text),
  public.sdo_m_j_salvar(text, text, boolean, jsonb, jsonb) to anon, authenticated;

-- balde do áudio do rádio e das fotos dos jogos: público pra ver, até 20 MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jogos', 'jogos', true, 20971520, array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists jogos_envia_arquivo on storage.objects;
create policy jogos_envia_arquivo on storage.objects for insert to anon, authenticated with check (bucket_id = 'jogos');
