-- =====================================================================
--  028 · ESTADOS DEL CLIENTE CON EFECTO REAL Y BORRADO SEGURO (8-oct-2026)
--  Se corre DESPUÉS de 027. Pedido de Luis: poder suspender, dar de baja y
--  eliminar clientes. Ver docs/superpowers/specs/2026-10-08-entregas-1-4-design.md
--
--  · suspendido: entra y ve todo, pero SOLO puede reportar depósitos
--    (la causa típica es la falta de pago). No agenda.
--  · baja: no entra (eso lo hace el servidor desactivando sus perfiles) y,
--    por si acaso, la base tampoco le deja escribir.
--  · El DELETE de un cliente queda para el dueño o el permiso
--    `eliminar_clientes`, y ya NO arrastra en cascada dinero, precios ni
--    solicitudes: el servidor los borra en orden y a la vista.
-- =====================================================================
begin;

-- ---------------------------------------------------------- quién y por qué
alter table public.clientes add column if not exists estado_motivo text;
alter table public.clientes add column if not exists estado_fecha timestamptz;
alter table public.clientes add column if not exists estado_por uuid references public.perfiles (id) on delete set null;
-- A quién bloqueó la baja: al reactivar se desbloquea SOLO a ellos (no a quien
-- ya le habían quitado el acceso a propósito).
alter table public.clientes add column if not exists bloqueados_por_baja uuid[] not null default '{}';

-- ---------------------------------------------------------- qué puede hacer el cliente
create or replace function public.mi_cliente_estado()
returns text language sql stable security definer set search_path = public as $$
  select estado from public.clientes where id = mi_cliente()
$$;

-- Agendar y demás operación: activo o pendiente-info.
create or replace function public.mi_cliente_puede_operar()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(mi_cliente_estado() in ('activo', 'pendiente-info'), false)
$$;

-- Pagar (reportar depósitos): también suspendido.
create or replace function public.mi_cliente_puede_pagar()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(mi_cliente_estado() in ('activo', 'pendiente-info', 'suspendido'), false)
$$;

revoke all on function public.mi_cliente_estado() from public, anon;
revoke all on function public.mi_cliente_puede_operar() from public, anon;
revoke all on function public.mi_cliente_puede_pagar() from public, anon;
grant execute on function public.mi_cliente_estado() to authenticated, service_role;
grant execute on function public.mi_cliente_puede_operar() to authenticated, service_role;
grant execute on function public.mi_cliente_puede_pagar() to authenticated, service_role;

-- La de la 022, más el estado.
drop policy if exists solicitudes_pide_el_cliente on public.solicitudes_recoleccion;
create policy solicitudes_pide_el_cliente on public.solicitudes_recoleccion
  for insert to authenticated
  with check (
    cliente_id = mi_cliente()
    and mi_cliente_puede_operar()
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

drop policy if exists movimientos_sube_el_cliente on public.movimientos_saldo;
create policy movimientos_sube_el_cliente on public.movimientos_saldo
  for insert to authenticated
  with check (
    cliente_id = mi_cliente() and mi_cliente_puede_pagar()
    and tipo = 'abono' and estado = 'por-verificar'
  );

drop policy if exists comprobantes_sube_cliente on storage.objects;
create policy comprobantes_sube_cliente on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprobantes' and carpeta_uuid(name) = mi_cliente() and mi_cliente_puede_pagar()
  );

-- ---------------------------------------------------------- borrar clientes
alter table public.perfiles drop constraint if exists perfiles_permisos_validos;
alter table public.perfiles add constraint perfiles_permisos_validos
  check (permisos <@ array['precios', 'eliminar_clientes']::text[]);

drop policy if exists clientes_personal on public.clientes;
drop policy if exists clientes_personal_lee on public.clientes;
create policy clientes_personal_lee on public.clientes for select to authenticated
  using (es_personal());
drop policy if exists clientes_personal_crea on public.clientes;
create policy clientes_personal_crea on public.clientes for insert to authenticated
  with check (es_personal());
drop policy if exists clientes_personal_edita on public.clientes;
create policy clientes_personal_edita on public.clientes for update to authenticated
  using (es_personal()) with check (es_personal());
drop policy if exists clientes_borra on public.clientes;
create policy clientes_borra on public.clientes for delete to authenticated
  using (es_dueno() or tiene_permiso('eliminar_clientes'));

-- Dinero, precios y solicitudes ya no se van en cascada con el cliente.
alter table public.movimientos_saldo drop constraint if exists movimientos_saldo_cliente_id_fkey;
alter table public.movimientos_saldo add constraint movimientos_saldo_cliente_id_fkey
  foreign key (cliente_id) references public.clientes (id) on delete restrict;
alter table public.precios drop constraint if exists precios_cliente_id_fkey;
alter table public.precios add constraint precios_cliente_id_fkey
  foreign key (cliente_id) references public.clientes (id) on delete restrict;
alter table public.solicitudes_recoleccion drop constraint if exists solicitudes_recoleccion_cliente_id_fkey;
alter table public.solicitudes_recoleccion add constraint solicitudes_recoleccion_cliente_id_fkey
  foreign key (cliente_id) references public.clientes (id) on delete restrict;

-- Los precios siguen sin editarse ni borrarse con sesión; el servidor
-- (llave de servicio, sin auth.uid) sí puede al eliminar un cliente.
create or replace function public.precios_no_se_tocan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or auth.uid() is null then
    return coalesce(new, old);
  end if;
  raise exception 'Los precios no se editan ni se borran: captura un precio nuevo.';
end;
$$;

commit;
