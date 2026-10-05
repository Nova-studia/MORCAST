-- =====================================================================
--  MORCAST DEL NORTE — 026: lo que necesita la versión 1.1 de las apps
--  Se corre DESPUÉS de 025-alta-con-firma.sql.
-- =====================================================================
--
--  QUÉ AGREGA
--  ----------
--   1. `push_tokens`: el "a dónde mandarle notificaciones" de cada teléfono
--      (un token de Expo por aparato), y dos funciones para que las apps lo
--      registren y lo borren al cerrar sesión.
--   2. `avisos_lecturas`: quién tocó "Enterado" en un aviso y cuándo, para
--      que el panel diga "Leído por 12 de 30".
--   3. En `avisos`: cuántas notificaciones salieron y a cuántos usuarios les
--      tocaba (la "Y" de "Leído por X de Y").
--   4. En `incidentes`: `avisado_en`, para que la oficina reciba UN aviso
--      por incidente aunque la app reintente la llamada.
--
--  El CONTRATO con las apps (iOS y Android) está escrito aquí y no se cambia
--  sin cambiar las dos apps: nombres de tablas, columnas y funciones.
--
--  Idempotente: se puede correr dos veces sin romper nada.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
--  1 · TOKENS DE NOTIFICACIONES (Expo Push)
-- ---------------------------------------------------------------------
--  Un token identifica a un TELÉFONO (a la instalación de la app), no a una
--  persona. Por eso `token` es único: si en un teléfono compartido entra otra
--  persona, el token pasa a ser de ella y la anterior deja de recibir ahí.
create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token       text unique not null,
  plataforma  text not null check (plataforma in ('ios', 'android')),
  creado      timestamptz default now(),
  actualizado timestamptz default now(),
  -- `ExponentPushToken[...]` (el que da expo-notifications) o el formato
  -- nuevo `ExpoPushToken[...]`. Cualquier otra cosa es basura o un intento
  -- de meter texto donde el servidor lo va a mandar a Expo.
  constraint push_token_formato check (
    token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{1,200}\]$'
  )
);
alter table public.push_tokens enable row level security;
create index if not exists push_tokens_usuario_idx on public.push_tokens (usuario_id);

-- Cada quien ve, mete, cambia y borra SOLO sus tokens. El servidor (llave de
-- servicio) es el único que lee los de todos para mandar notificaciones.
drop policy if exists push_tokens_propios on public.push_tokens;
create policy push_tokens_propios on public.push_tokens
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- El `upsert({token, plataforma}, {onConflict: 'token'})` directo de la app
-- funciona mientras el token sea suyo o nuevo. Si el token ya era de OTRA
-- persona (teléfono compartido), el RLS no deja tocar esa fila y el upsert
-- falla. Por eso las apps deben usar esta función: hace el cambio de dueño
-- del lado de la base, solo para el token que el propio teléfono presenta, y
-- siempre a nombre de quien llama (`auth.uid()`), nunca de quien diga el
-- teléfono.
--
--   supabase.rpc('registrar_push_token', { p_token, p_plataforma })
--
-- Quitárselo al usuario anterior no le da nada al nuevo que no tuviera: ya
-- tiene el teléfono en la mano, y el token solo sirve para MANDAR a ese
-- teléfono (lo hace el servidor de Morcast, no la app).
create or replace function public.registrar_push_token(p_token text, p_plataforma text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Hace falta una sesión para registrar notificaciones.';
  end if;
  if p_plataforma is null or p_plataforma not in ('ios', 'android') then
    raise exception 'Plataforma no válida (ios o android).';
  end if;
  -- El formato lo revisa la restricción `push_token_formato` de la tabla.
  insert into public.push_tokens as t (usuario_id, token, plataforma)
  values (v_uid, btrim(p_token), p_plataforma)
  on conflict (token) do update
    set usuario_id  = v_uid,
        plataforma  = excluded.plataforma,
        actualizado = now();
  return true;
end;
$$;

-- Al cerrar sesión: el teléfono deja de recibir avisos de esta cuenta. Solo
-- borra el token si es de quien llama; uno ajeno se queda como está.
create or replace function public.borrar_push_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borrados integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  delete from public.push_tokens
   where token = btrim(p_token) and usuario_id = auth.uid();
  get diagnostics v_borrados = row_count;
  return v_borrados > 0;
end;
$$;

revoke all on function public.registrar_push_token(text, text) from public, anon;
revoke all on function public.borrar_push_token(text) from public, anon;
grant execute on function public.registrar_push_token(text, text) to authenticated;
grant execute on function public.borrar_push_token(text) to authenticated;


-- ---------------------------------------------------------------------
--  2 · LECTURAS DE AVISOS ("Enterado")
-- ---------------------------------------------------------------------
create table if not exists public.avisos_lecturas (
  aviso_id   uuid references public.avisos (id) on delete cascade,
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cliente_id uuid default public.mi_cliente(),
  leido      timestamptz not null default now(),
  primary key (aviso_id, usuario_id)
);
alter table public.avisos_lecturas enable row level security;

-- El cliente anota SU lectura y solo de un aviso que puede ver. El `exists`
-- sobre `avisos` corre con el RLS de quien inserta, o sea con
-- `avisos_lee_cliente` (db/024): un aviso de otra empresa, para él, no
-- existe. La empresa tiene que ser la suya (o el panel atribuiría la lectura
-- a otra). El personal no anota lecturas: `mi_cliente()` es null para ellos.
drop policy if exists avisos_lecturas_anota_cliente on public.avisos_lecturas;
create policy avisos_lecturas_anota_cliente on public.avisos_lecturas
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and public.mi_cliente() is not null
    and cliente_id = public.mi_cliente()
    and exists (select 1 from public.avisos a where a.id = aviso_id)
  );

drop policy if exists avisos_lecturas_lee_propias on public.avisos_lecturas;
create policy avisos_lecturas_lee_propias on public.avisos_lecturas
  for select to authenticated
  using (usuario_id = auth.uid());

drop policy if exists avisos_lecturas_lee_personal on public.avisos_lecturas;
create policy avisos_lecturas_lee_personal on public.avisos_lecturas
  for select to authenticated
  using (es_personal());

-- La hora la pone la base, no el teléfono: si no, una app con el reloj mal
-- (o alguien con mala intención) diría que leyó el aviso antes de que se
-- mandara. Sin políticas de UPDATE ni DELETE nadie la cambia después.
create or replace function public.lectura_hora_de_la_base()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.leido := now();
  return new;
end;
$$;
drop trigger if exists lectura_hora_de_la_base_tg on public.avisos_lecturas;
create trigger lectura_hora_de_la_base_tg
  before insert on public.avisos_lecturas
  for each row execute function public.lectura_hora_de_la_base();


-- ---------------------------------------------------------------------
--  3 · Lo que el historial de avisos necesita saber
-- ---------------------------------------------------------------------
--  `usuarios_destino` se fija al mandar: son las cuentas de cliente activas
--  de las empresas a las que fue. Así "Leído por X de Y" no cambia de
--  denominador cada vez que una empresa da de alta o de baja a alguien.
--  En los avisos de antes de esta migración queda null (no se sabe).
alter table public.avisos add column if not exists notificaciones_enviadas integer not null default 0;
alter table public.avisos add column if not exists usuarios_destino integer;


-- ---------------------------------------------------------------------
--  4 · Un aviso a la oficina por incidente
-- ---------------------------------------------------------------------
--  La app guarda el incidente directo (bajo RLS) y después le pide al
--  servidor que avise. Si la señal se cae a medio camino, la app reintenta:
--  `avisado_en` se marca en la misma sentencia que decide avisar, así que el
--  segundo intento ya no manda otro correo ni otra notificación.
alter table public.incidentes add column if not exists avisado_en timestamptz;

-- Misma política de db/023 con un renglón más: el chofer no puede meter el
-- incidente ya marcado como "avisado", que dejaría a la oficina sin saberlo.
drop policy if exists incidentes_reporta_operador on public.incidentes;
create policy incidentes_reporta_operador on public.incidentes
  for insert to authenticated
  with check (
    mi_rol() = 'operador'
    and operador_id = auth.uid()
    and estado = 'abierto'
    and atendido_por is null
    and avisado_en is null
    and (solicitud_id is null or solicitud_id in (select public.mis_paradas()))
  );


-- Supabase da por defecto todos los permisos de las tablas nuevas a anon:
-- con RLS no verían nada, pero no tienen por qué ni intentarlo.
revoke all on public.push_tokens, public.avisos_lecturas from anon;

commit;
