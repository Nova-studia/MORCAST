-- =====================================================================
--  MORCAST DEL NORTE — 022: candados de seguridad (auditoría del 4-oct-2026)
--  Se corre DESPUÉS de 021-trabaja-con-nosotros.sql.
-- =====================================================================
--
--  POR QUÉ
--  -------
--  Los dueños pidieron (4-oct) "seguridad para roles administrativos: que no
--  se filtre información delicada". La auditoría encontró que la base ya
--  separa bien al cliente y al chofer, pero que:
--
--   1. La vista `cotizaciones_pendientes` corre con los permisos de quien la
--      creó y se SALTA el RLS de `cotizaciones`: con la llave pública de la
--      web se podían leer nombre, teléfono, correo y dirección de cada
--      prospecto.
--   2. En la base, un ADMIN valía casi lo mismo que el DUEÑO: podía ponerse
--      `rol = 'dueno'` a sí mismo, dar rol de admin a cualquiera, desactivar
--      al dueño, o meter un abono que naciera ya `aplicada` (dinero que solo
--      el dueño debe dar por bueno).
--   3. Faltaban límites por columna: el cliente podía pedir una recolección
--      con un chofer o una fecha confirmada puestos por él, o en el domicilio
--      de otra empresa; el chofer podía cambiar cualquier columna de su
--      parada, no solo el estado.
--   4. Lo que se hace desde la app o directo contra la API no quedaba en la
--      bitácora: solo lo que pasaba por las acciones del servidor.
--   5. Los formularios públicos (cotizar, registro) no tenían un freno que
--      sirva en Vercel, donde cada instancia tiene su propia memoria.
--
--  Todo es idempotente: se puede correr dos veces sin romper nada.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
--  1 · La vista de prospectos respeta el RLS de quien la consulta
-- ---------------------------------------------------------------------
--  Con `security_invoker` la vista pregunta con los permisos del que la lee:
--  el personal (política `cotizaciones_personal` de 007) la sigue viendo, y
--  un anónimo o un cliente ven cero filas. Además se le quita el permiso a
--  los visitantes sin sesión: no tienen nada que hacer ahí.
alter view if exists public.cotizaciones_pendientes set (security_invoker = true);
revoke all on public.cotizaciones_pendientes from anon;


-- ---------------------------------------------------------------------
--  2 · Solo el dueño da, quita o toca el acceso administrativo
-- ---------------------------------------------------------------------
--  Reglas, de arriba abajo:
--   · Sin sesión (llave de servicio o un trigger interno): pasa. El RLS ya
--     impide que un anónimo llegue aquí (ver la nota de 004).
--   · El dueño: puede todo.
--   · Un admin: administra choferes, clientes y pendientes, pero NO puede
--     crear otro admin o dueño, ni tocar el rol, la empresa o el estado de
--     una cuenta que ya es admin o dueño — tampoco la suya.
--   · Cualquier otro: no se cambia su rol, empresa ni estado (lo de siempre).
--  Por qué así: con una sola cuenta de admin robada no se pueden abrir
--  puertas nuevas (otro admin) que sobrevivan al cambio de su contraseña, ni
--  ascenderse a dueño para mover dinero.
create or replace function public.perfil_sin_escalar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if es_dueno() then
    return new;
  end if;

  if es_personal() then
    if new.rol in ('dueno', 'admin')
       and (tg_op = 'INSERT' or new.rol is distinct from old.rol) then
      raise exception 'Solo el dueño puede dar acceso de administrador.';
    end if;
    if tg_op = 'UPDATE' and old.rol in ('dueno', 'admin')
       and (new.rol        is distinct from old.rol
         or new.cliente_id is distinct from old.cliente_id
         or new.activo     is distinct from old.activo) then
      raise exception 'Solo el dueño puede cambiar una cuenta de administración.';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'No puedes crear perfiles.';
  end if;
  if new.rol        is distinct from old.rol
     or new.cliente_id is distinct from old.cliente_id
     or new.activo     is distinct from old.activo then
    raise exception 'No puedes cambiar tu rol, tu empresa ni tu estado.';
  end if;
  return new;
end;
$$;

drop trigger if exists perfil_sin_escalar_tg on public.perfiles;
create trigger perfil_sin_escalar_tg
  before insert or update on public.perfiles
  for each row execute function public.perfil_sin_escalar();

-- Borrar el perfil de un admin o del dueño también es quitarle el acceso.
create or replace function public.perfil_no_se_borra_personal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not es_dueno() and old.rol in ('dueno', 'admin') then
    raise exception 'Solo el dueño puede borrar una cuenta de administración.';
  end if;
  return old;
end;
$$;

drop trigger if exists perfil_no_se_borra_personal_tg on public.perfiles;
create trigger perfil_no_se_borra_personal_tg
  before delete on public.perfiles
  for each row execute function public.perfil_no_se_borra_personal();


-- ---------------------------------------------------------------------
--  3 · Un admin registra depósitos, pero solo el dueño los da por buenos
-- ---------------------------------------------------------------------
--  Antes `movimientos_crea_personal` dejaba a cualquier admin insertar un
--  abono que naciera `aplicada`: subía el saldo de un cliente sin pasar por
--  el dueño, aunque APLICAR (el update) ya estaba reservado al dueño. Hoy
--  ninguna pantalla inserta otra cosa que `por-verificar`, así que esto no
--  cambia nada del uso normal; cierra la puerta de llamar a la API directo.
drop policy if exists movimientos_crea_personal on public.movimientos_saldo;
create policy movimientos_crea_personal on public.movimientos_saldo
  for insert to authenticated
  with check (
    es_personal()
    and (es_dueno() or tipo = 'cargo' or estado = 'por-verificar')
  );


-- ---------------------------------------------------------------------
--  4 · El cliente pide a su nombre, en SU domicilio, y sin adelantarse
-- ---------------------------------------------------------------------
--  Chofer, fecha y hora confirmadas, y el motivo de rechazo los pone
--  Morcast. Antes el cliente podía mandarlos ya llenos.
--
--  El domicilio se comprueba con una función SECURITY DEFINER y no con un
--  `select ... from domicilios` dentro de la política: las políticas de
--  `domicilios` preguntan a su vez por `solicitudes_recoleccion` (el chofer
--  ve los domicilios de sus paradas), y Postgres corta con "infinite
--  recursion detected in policy". Mismo remedio que `mis_paradas()` en 013.
create or replace function public.mis_domicilios()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.domicilios where cliente_id = public.mi_cliente()
$$;

revoke all on function public.mis_domicilios() from public;
grant execute on function public.mis_domicilios() to authenticated;

drop policy if exists solicitudes_pide_el_cliente on public.solicitudes_recoleccion;
create policy solicitudes_pide_el_cliente on public.solicitudes_recoleccion
  for insert to authenticated
  with check (
    cliente_id = mi_cliente()
    and estado = 'solicitada'
    and fecha_pedida >= (current_date - 1)
    and fecha_pedida <= (current_date + 365)
    and chofer_id is null
    and fecha_confirmada is null
    and hora_confirmada is null
    and motivo_rechazo is null
    and (
      domicilio_id is null
      or domicilio_id in (select public.mis_domicilios())
    )
  );


-- ---------------------------------------------------------------------
--  5 · El chofer solo cambia el ESTADO de su parada
-- ---------------------------------------------------------------------
--  La política `solicitudes_cierra_operador` (013) decide QUÉ paradas y a
--  qué estados; las políticas no saben de columnas, así que esto lo remata
--  un trigger: si quien actualiza es un chofer, todo lo que no sea `estado`
--  tiene que quedar igual. Es exactamente lo que hacen hoy la web y las apps
--  (`.update({ estado })`).
create or replace function public.chofer_solo_cambia_estado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and mi_rol() = 'operador'
     and (to_jsonb(new) - 'estado') is distinct from (to_jsonb(old) - 'estado') then
    raise exception 'El chofer solo puede cambiar el estado de su parada.';
  end if;
  return new;
end;
$$;

drop trigger if exists chofer_solo_cambia_estado_tg on public.solicitudes_recoleccion;
create trigger chofer_solo_cambia_estado_tg
  before update on public.solicitudes_recoleccion
  for each row execute function public.chofer_solo_cambia_estado();


-- ---------------------------------------------------------------------
--  6 · La bitácora ve lo delicado venga de donde venga
-- ---------------------------------------------------------------------
--  Se anota desde la BASE, no desde la pantalla: así queda firmado igual si
--  el cambio llega de la web, de la app o de alguien que llama a la API con
--  una sesión robada. No se anota todo (cada parada que el chofer cierra
--  inundaría la bitácora): solo dinero, accesos y borrados.
--
--  `actor_correo` sale del token de la sesión. Sin sesión es la llave de
--  servicio (el servidor o un script), y queda como "sistema".
create or replace function public.bitacora_desde_la_base()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viejo  jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_nuevo  jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_fila   jsonb := coalesce(v_nuevo, v_viejo);
  v_cambio jsonb := '{}'::jsonb;
  v_llave  text;
begin
  -- En un UPDATE solo interesa lo que cambió, con el antes y el después.
  if tg_op = 'UPDATE' then
    for v_llave in select jsonb_object_keys(v_nuevo) loop
      if v_nuevo -> v_llave is distinct from v_viejo -> v_llave then
        v_cambio := v_cambio || jsonb_build_object(
          v_llave, jsonb_build_object('antes', v_viejo -> v_llave, 'despues', v_nuevo -> v_llave)
        );
      end if;
    end loop;
    if v_cambio = '{}'::jsonb then
      return null;
    end if;
  end if;

  insert into public.bitacora (actor_id, actor_correo, accion, tabla, registro_id, detalle)
  values (
    auth.uid(),
    coalesce(auth.jwt() ->> 'email', case when auth.uid() is null then 'sistema' end),
    'db_' || lower(tg_op),
    tg_table_name,
    v_fila ->> 'id',
    jsonb_strip_nulls(jsonb_build_object(
      'folio',   v_fila ->> 'folio',
      'monto',   v_fila -> 'monto',
      'estado',  v_fila ->> 'estado',
      'nombre',  coalesce(v_fila ->> 'nombre', v_fila ->> 'empresa'),
      'rol_nuevo', case when tg_table_name = 'perfiles' then v_nuevo ->> 'rol' end,
      'cambios', case when tg_op = 'UPDATE' then v_cambio end,
      'fila',    case when tg_op = 'DELETE' then v_viejo end
    ))
  );
  return null;
end;
$$;

revoke all on function public.bitacora_desde_la_base() from public;

-- Dinero: cualquier alta o cambio de un movimiento de saldo.
drop trigger if exists bitacora_movimientos_tg on public.movimientos_saldo;
create trigger bitacora_movimientos_tg
  after insert or update or delete on public.movimientos_saldo
  for each row execute function public.bitacora_desde_la_base();

-- Accesos: quién entra y con qué rol.
drop trigger if exists bitacora_perfiles_tg on public.perfiles;
create trigger bitacora_perfiles_tg
  after insert or delete or update of rol, cliente_id, activo on public.perfiles
  for each row execute function public.bitacora_desde_la_base();

-- Clientes: altas, bajas y cambios de estado o de datos fiscales.
drop trigger if exists bitacora_clientes_tg on public.clientes;
create trigger bitacora_clientes_tg
  after insert or delete
     or update of estado, rfc, regimen, domicilio_fiscal, codigo_postal, correo, dias_credito, limite_credito
  on public.clientes
  for each row execute function public.bitacora_desde_la_base();

-- Borrados de la operación: una ruta, una parada o un punto que desaparece.
drop trigger if exists bitacora_rutas_tg on public.rutas;
create trigger bitacora_rutas_tg
  after delete on public.rutas
  for each row execute function public.bitacora_desde_la_base();

drop trigger if exists bitacora_solicitudes_tg on public.solicitudes_recoleccion;
create trigger bitacora_solicitudes_tg
  after delete on public.solicitudes_recoleccion
  for each row execute function public.bitacora_desde_la_base();

drop trigger if exists bitacora_domicilios_tg on public.domicilios;
create trigger bitacora_domicilios_tg
  after delete on public.domicilios
  for each row execute function public.bitacora_desde_la_base();


-- ---------------------------------------------------------------------
--  7 · Freno para los formularios públicos
-- ---------------------------------------------------------------------
--  Mismo truco que 018: una sola sentencia decide, así que dos peticiones a
--  la vez no pasan las dos. Sirve para cualquier formulario: la clave es
--  "<formulario>:<ip>". Solo la llave de servicio (el servidor) la llama.
create table if not exists public.frenos (
  clave   text primary key,
  inicio  timestamptz not null default now(),
  conteo  integer not null default 1
);
alter table public.frenos enable row level security;  -- sin políticas: nadie de afuera

create or replace function public.pasar_freno(p_clave text, p_maximo integer, p_ventana interval)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conteo integer;
begin
  insert into public.frenos as f (clave, inicio, conteo)
  values (p_clave, now(), 1)
  on conflict (clave) do update
    set inicio = case when f.inicio < now() - p_ventana then now() else f.inicio end,
        conteo = case when f.inicio < now() - p_ventana then 1 else f.conteo + 1 end
  returning conteo into v_conteo;

  -- Limpieza de paso: lo de hace más de un día ya no frena a nadie.
  delete from public.frenos where inicio < now() - interval '1 day';

  return v_conteo <= p_maximo;
end;
$$;

revoke all on function public.pasar_freno(text, integer, interval) from public, anon, authenticated;
grant execute on function public.pasar_freno(text, integer, interval) to service_role;

commit;
