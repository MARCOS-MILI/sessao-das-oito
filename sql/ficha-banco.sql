-- Fichas da Sessão das Oito: tabelas e funções.
-- Roda no SQL Editor do Supabase. Pode rodar de novo sem estragar nada.
--
-- Como funciona:
--  * As tabelas ficam fechadas pro público (RLS ligado e sem política nenhuma).
--  * O site só fala com o banco por funções.
--  * O jogador usa o link pessoal (um código longo) e só lê e salva a ficha dele.
--  * O mestre usa a senha dele pra ver, criar, editar e apagar todas as fichas.

create table if not exists public.sdo_config (
  id int primary key default 1 check (id = 1),
  senha_hash text not null
);

create table if not exists public.sdo_modelos (
  id text primary key,
  dados jsonb not null
);

create table if not exists public.sdo_fichas (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  modelo text,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.sdo_config enable row level security;
alter table public.sdo_modelos enable row level security;
alter table public.sdo_fichas enable row level security;
revoke all on public.sdo_config, public.sdo_modelos, public.sdo_fichas from anon, authenticated;

-- confere a senha do mestre (errou, espera 2 segundos pra atrapalhar quem tenta adivinhar)
create or replace function public.sdo_chk(p_senha text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.sdo_config
    where id = 1 and senha_hash = encode(sha256(convert_to('sdo:' || coalesce(p_senha, ''), 'utf8')), 'hex')
  ) then
    perform pg_sleep(2);
    raise exception 'senha_errada';
  end if;
end $$;
revoke all on function public.sdo_chk(text) from public, anon, authenticated;

-- jogador: ler a própria ficha pelo link
create or replace function public.sdo_ler(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.sdo_fichas;
begin
  select * into r from public.sdo_fichas where token = p_token;
  if not found then raise exception 'nao_encontrada'; end if;
  return jsonb_build_object('dados', r.dados, 'atualizado_em', r.atualizado_em);
end $$;

-- jogador: salvar só o que mudou na própria ficha
create or replace function public.sdo_salvar(p_token text, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'patch_invalido'; end if;
  if length(p_patch::text) > 200000 then raise exception 'grande_demais'; end if;
  update public.sdo_fichas set dados = dados || p_patch, atualizado_em = now() where token = p_token;
  if not found then raise exception 'nao_encontrada'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- mestre: modelos de personagem
create or replace function public.sdo_m_modelos(p_senha text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.sdo_chk(p_senha);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'dados', dados) order by id) from public.sdo_modelos), '[]'::jsonb);
end $$;

-- mestre: todas as fichas
create or replace function public.sdo_m_listar(p_senha text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.sdo_chk(p_senha);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'token', token, 'modelo', modelo, 'dados', dados, 'atualizado_em', atualizado_em) order by atualizado_em desc)
    from public.sdo_fichas
  ), '[]'::jsonb);
end $$;

-- mestre: criar ficha a partir de um modelo (ou em branco)
create or replace function public.sdo_m_criar(p_senha text, p_modelo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m jsonb; novo public.sdo_fichas;
begin
  perform public.sdo_chk(p_senha);
  if p_modelo = '__blank' then
    m := '{}'::jsonb;
  else
    select dados into m from public.sdo_modelos where id = p_modelo;
    if m is null then raise exception 'modelo_inexistente'; end if;
  end if;
  insert into public.sdo_fichas (modelo, dados)
  values (p_modelo, (m - 'resumo' - 'paleta') || jsonb_build_object(
    'modeloId', p_modelo, 'log', '[]'::jsonb, 'criadoEm', (extract(epoch from now()) * 1000)::bigint))
  returning * into novo;
  return jsonb_build_object('id', novo.id, 'token', novo.token);
end $$;

-- mestre: salvar na ficha de qualquer jogador
create or replace function public.sdo_m_salvar(p_senha text, p_id uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.sdo_chk(p_senha);
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'patch_invalido'; end if;
  update public.sdo_fichas set dados = dados || p_patch, atualizado_em = now() where id = p_id;
  if not found then raise exception 'nao_encontrada'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- mestre: apagar ficha
create or replace function public.sdo_m_apagar(p_senha text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.sdo_chk(p_senha);
  delete from public.sdo_fichas where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.sdo_ler(text), public.sdo_salvar(text, jsonb),
  public.sdo_m_modelos(text), public.sdo_m_listar(text), public.sdo_m_criar(text, text),
  public.sdo_m_salvar(text, uuid, jsonb), public.sdo_m_apagar(text, uuid) from public;
grant execute on function public.sdo_ler(text), public.sdo_salvar(text, jsonb),
  public.sdo_m_modelos(text), public.sdo_m_listar(text), public.sdo_m_criar(text, text),
  public.sdo_m_salvar(text, uuid, jsonb), public.sdo_m_apagar(text, uuid) to anon, authenticated;
