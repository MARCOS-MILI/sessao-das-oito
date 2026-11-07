-- Terminal da Sessão das Oito: tabelas e funções.
-- Roda no SQL Editor do Supabase, DEPOIS do ficha-banco.sql (usa a senha do mestre que ele já criou).
-- Pode rodar de novo sem estragar nada.
--
-- Como funciona:
--  * As tabelas ficam fechadas pro público (RLS ligado e sem política nenhuma).
--  * O site só fala com o banco por funções.
--  * Os jogadores entram no terminal com a senha do terminal (a que eles descobrem na sessão)
--    e só leem o que o mestre liberou.
--  * O mestre usa a senha dele (a mesma da ficha) pra criar, liberar, esconder e apagar.
--  * A senha do terminal fica só no banco, guardada como hash. Defina pela tela do mestre (terminal.html?mestre).

create table if not exists public.sdo_term_config (
  id int primary key default 1 check (id = 1),
  senha_hash text not null
);

create table if not exists public.sdo_term_itens (
  id bigint generated always as identity primary key,
  tipo text not null default 'arquivo' check (tipo in ('arquivo', 'mensagem')),
  nome text not null default '',
  titulo text not null default '',
  corpo text not null default '',
  visivel boolean not null default false,
  criado_em timestamptz not null default now(),
  liberado_em timestamptz
);

alter table public.sdo_term_config enable row level security;
alter table public.sdo_term_itens enable row level security;
revoke all on public.sdo_term_config, public.sdo_term_itens from anon, authenticated;

-- tira acento, apara espaço e põe em maiúscula (a senha do terminal não liga pra isso)
create or replace function public.sdo_t_norm(p text) returns text
language sql immutable as $$
  select upper(translate(trim(coalesce(p, '')),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
$$;

-- confere a senha do terminal (errou, espera 2 segundos pra atrapalhar quem tenta adivinhar)
create or replace function public.sdo_t_chk(p_senha text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.sdo_term_config
    where id = 1 and senha_hash = encode(sha256(convert_to('sdoterm:' || public.sdo_t_norm(p_senha), 'utf8')), 'hex')
  ) then
    perform pg_sleep(2);
    raise exception 'senha_errada';
  end if;
end $$;

-- jogador: tudo que o mestre já liberou, na ordem em que foi liberado
create or replace function public.sdo_t_ler(p_senha text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.sdo_t_chk(p_senha);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'tipo', tipo, 'nome', nome, 'titulo', titulo, 'corpo', corpo, 'liberado_em', liberado_em
    ) order by liberado_em, id)
    from public.sdo_term_itens where visivel
  ), '[]'::jsonb);
end $$;

-- mestre: tudo (liberado ou não) e se a senha do terminal já foi definida
create or replace function public.sdo_m_t_listar(p_senha text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.sdo_chk(p_senha);
  return jsonb_build_object(
    'itens', coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.sdo_term_itens i), '[]'::jsonb),
    'senha_definida', exists (select 1 from public.sdo_term_config where id = 1)
  );
end $$;

-- mestre: criar (p_id nulo) ou editar um item
create or replace function public.sdo_m_t_salvar(
  p_senha text, p_id bigint, p_tipo text, p_nome text, p_titulo text, p_corpo text, p_visivel boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare novo public.sdo_term_itens;
begin
  perform public.sdo_chk(p_senha);
  if p_tipo is null or p_tipo not in ('arquivo', 'mensagem') then raise exception 'tipo_invalido'; end if;
  if length(coalesce(p_corpo, '')) > 20000 or length(coalesce(p_titulo, '')) > 200 or length(coalesce(p_nome, '')) > 60 then
    raise exception 'grande_demais';
  end if;
  if p_id is null then
    insert into public.sdo_term_itens (tipo, nome, titulo, corpo, visivel, liberado_em)
    values (p_tipo, coalesce(p_nome, ''), coalesce(p_titulo, ''), coalesce(p_corpo, ''),
            coalesce(p_visivel, false), case when coalesce(p_visivel, false) then now() end)
    returning * into novo;
  else
    update public.sdo_term_itens set
      tipo = p_tipo,
      nome = coalesce(p_nome, ''),
      titulo = coalesce(p_titulo, ''),
      corpo = coalesce(p_corpo, ''),
      liberado_em = case
        when coalesce(p_visivel, false) and (not visivel or liberado_em is null) then now()
        when coalesce(p_visivel, false) then liberado_em
        else null end,
      visivel = coalesce(p_visivel, false)
    where id = p_id
    returning * into novo;
    if not found then raise exception 'nao_encontrado'; end if;
  end if;
  return to_jsonb(novo);
end $$;

-- mestre: liberar ou esconder um item
create or replace function public.sdo_m_t_visivel(p_senha text, p_id bigint, p_visivel boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.sdo_chk(p_senha);
  update public.sdo_term_itens set
    liberado_em = case
      when coalesce(p_visivel, false) and (not visivel or liberado_em is null) then now()
      when coalesce(p_visivel, false) then liberado_em
      else null end,
    visivel = coalesce(p_visivel, false)
  where id = p_id;
  if not found then raise exception 'nao_encontrado'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- mestre: apagar um item
create or replace function public.sdo_m_t_apagar(p_senha text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.sdo_chk(p_senha);
  delete from public.sdo_term_itens where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- mestre: definir ou trocar a senha do terminal
create or replace function public.sdo_m_t_senha(p_senha text, p_nova text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.sdo_chk(p_senha);
  if length(public.sdo_t_norm(p_nova)) < 3 then raise exception 'senha_curta'; end if;
  insert into public.sdo_term_config (id, senha_hash)
  values (1, encode(sha256(convert_to('sdoterm:' || public.sdo_t_norm(p_nova), 'utf8')), 'hex'))
  on conflict (id) do update set senha_hash = excluded.senha_hash;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.sdo_t_norm(text), public.sdo_t_chk(text), public.sdo_t_ler(text),
  public.sdo_m_t_listar(text), public.sdo_m_t_salvar(text, bigint, text, text, text, text, boolean),
  public.sdo_m_t_visivel(text, bigint, boolean), public.sdo_m_t_apagar(text, bigint),
  public.sdo_m_t_senha(text, text) from public;
grant execute on function public.sdo_t_ler(text), public.sdo_m_t_listar(text),
  public.sdo_m_t_salvar(text, bigint, text, text, text, text, boolean),
  public.sdo_m_t_visivel(text, bigint, boolean), public.sdo_m_t_apagar(text, bigint),
  public.sdo_m_t_senha(text, text) to anon, authenticated;
