-- =====================================================================
--  MORCAST DEL NORTE — Seguridad por fila (RLS)
--  Se corre DESPUÉS de 001-esquema.sql.
-- =====================================================================
--
--  QUÉ ES ESTO, EN CORTO
--  ---------------------
--  La regla "cada cliente solo ve lo suyo" se escribe UNA vez, aquí, dentro
--  de la base de datos. No en la pantalla.
--
--  Por qué importa: si la regla vive en el frontend, se salta abriendo la
--  consola del navegador. Viviendo aquí, la base de datos se niega a
--  entregar la fila aunque alguien pida los datos a mano. Y como es la misma
--  base para la web, el iPhone y el Android, la regla vale para las tres sin
--  volver a escribirla.
--
--  ⚠️ La llave de servicio (SUPABASE_SERVICE_ROLE_KEY) SALTA todas estas
--  políticas. Por eso solo se usa en el servidor y nunca se manda al
--  navegador con NEXT_PUBLIC_.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funciones de apoyo.
--
-- Van como SECURITY DEFINER a propósito: leen `perfiles` saltándose el RLS.
-- Si no, una política sobre `perfiles` que preguntara el rol tendría que
-- leer `perfiles`... para poder leer `perfiles`. Recursión infinita.
--
-- `set search_path = public` fija dónde buscan las tablas: sin eso, alguien
-- con permiso de crear esquemas podría suplantarlas.
-- ---------------------------------------------------------------------
create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;

create or replace function public.mi_cliente()
returns uuid language sql stable security definer set search_path = public as $$
  select cliente_id from public.perfiles where id = auth.uid() and activo
$$;

-- Personal de Morcast: dueño o administrador.
create or replace function public.es_personal()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select rol in ('dueno','admin')
                   from public.perfiles where id = auth.uid() and activo), false)
$$;

-- Solo el dueño. Se reserva para lo que mueve dinero.
create or replace function public.es_dueno()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select rol = 'dueno'
                   from public.perfiles where id = auth.uid() and activo), false)
$$;

-- ---------------------------------------------------------------------
-- Encender RLS en TODAS las tablas.
-- Con RLS encendido y sin políticas, nadie ve nada. Se abre a partir de ahí.
-- ---------------------------------------------------------------------
alter table public.clientes                enable row level security;
alter table public.perfiles                enable row level security;
alter table public.rutas                   enable row level security;
alter table public.domicilios              enable row level security;
alter table public.suscripciones           enable row level security;
alter table public.solicitudes_recoleccion enable row level security;
alter table public.recolecciones           enable row level security;
alter table public.movimientos_saldo       enable row level security;
alter table public.zonas_pedidas           enable row level security;
alter table public.bitacora                enable row level security;

-- =====================================================================
-- CLIENTES
-- =====================================================================
drop policy if exists clientes_personal on public.clientes;
create policy clientes_personal on public.clientes
  for all to authenticated
  using (es_personal()) with check (es_personal());

-- El cliente ve su propia ficha, pero NO la puede editar: sus datos fiscales
-- los cambia Morcast, porque de ahí salen las facturas.
drop policy if exists clientes_ve_lo_suyo on public.clientes;
create policy clientes_ve_lo_suyo on public.clientes
  for select to authenticated
  using (id = mi_cliente());

-- =====================================================================
-- PERFILES
-- =====================================================================
drop policy if exists perfiles_personal on public.perfiles;
create policy perfiles_personal on public.perfiles
  for all to authenticated
  using (es_personal()) with check (es_personal());

drop policy if exists perfiles_ve_el_suyo on public.perfiles;
create policy perfiles_ve_el_suyo on public.perfiles
  for select to authenticated
  using (id = auth.uid());

-- Puede corregir su nombre y su teléfono. El rol y la empresa NO: eso se
-- bloquea con el trigger de abajo, no con la política.
drop policy if exists perfiles_edita_el_suyo on public.perfiles;
create policy perfiles_edita_el_suyo on public.perfiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Candado real contra la escalada de privilegios: aunque la política deje
-- actualizar la fila propia, aquí se rechaza cualquier intento de cambiarse
-- el rol o la empresa a sí mismo.
create or replace function public.perfil_sin_escalar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if es_personal() then
    return new;                       -- Morcast sí puede reasignar
  end if;
  if new.rol is distinct from old.rol
     or new.cliente_id is distinct from old.cliente_id
     or new.activo is distinct from old.activo then
    raise exception 'No puedes cambiar tu rol, tu empresa ni tu estado.';
  end if;
  return new;
end;
$$;

drop trigger if exists perfil_sin_escalar_tg on public.perfiles;
create trigger perfil_sin_escalar_tg
  before update on public.perfiles
  for each row execute function public.perfil_sin_escalar();

-- =====================================================================
-- RUTAS
-- Cualquiera con sesión puede LEERLAS: el mapa de cobertura las necesita.
-- La zona dibujada no es un secreto; es justo lo que se le presume al cliente.
-- =====================================================================
drop policy if exists rutas_lectura on public.rutas;
create policy rutas_lectura on public.rutas
  for select to authenticated using (true);

drop policy if exists rutas_personal on public.rutas;
create policy rutas_personal on public.rutas
  for all to authenticated
  using (es_personal()) with check (es_personal());

-- =====================================================================
-- DOMICILIOS
-- =====================================================================
drop policy if exists domicilios_personal on public.domicilios;
create policy domicilios_personal on public.domicilios
  for all to authenticated
  using (es_personal()) with check (es_personal());

drop policy if exists domicilios_del_cliente on public.domicilios;
create policy domicilios_del_cliente on public.domicilios
  for select to authenticated
  using (cliente_id = mi_cliente());

-- =====================================================================
-- SUSCRIPCIONES
-- =====================================================================
drop policy if exists suscripciones_personal on public.suscripciones;
create policy suscripciones_personal on public.suscripciones
  for all to authenticated
  using (es_personal()) with check (es_personal());

drop policy if exists suscripciones_del_cliente on public.suscripciones;
create policy suscripciones_del_cliente on public.suscripciones
  for select to authenticated
  using (cliente_id = mi_cliente());

-- =====================================================================
-- SOLICITUDES DE RECOLECCIÓN
-- =====================================================================
drop policy if exists solicitudes_personal on public.solicitudes_recoleccion;
create policy solicitudes_personal on public.solicitudes_recoleccion
  for all to authenticated
  using (es_personal()) with check (es_personal());

drop policy if exists solicitudes_ve_el_cliente on public.solicitudes_recoleccion;
create policy solicitudes_ve_el_cliente on public.solicitudes_recoleccion
  for select to authenticated
  using (cliente_id = mi_cliente());

-- El cliente puede PEDIR, pero solo a nombre de su propia empresa y solo en
-- estado 'solicitada'. No puede darse por confirmado él mismo.
drop policy if exists solicitudes_pide_el_cliente on public.solicitudes_recoleccion;
create policy solicitudes_pide_el_cliente on public.solicitudes_recoleccion
  for insert to authenticated
  with check (cliente_id = mi_cliente() and estado = 'solicitada');

-- El chofer ve solo las paradas de las rutas que trae asignadas.
drop policy if exists solicitudes_del_operador on public.solicitudes_recoleccion;
create policy solicitudes_del_operador on public.solicitudes_recoleccion
  for select to authenticated
  using (
    mi_rol() = 'operador'
    and ruta_id in (select id from public.rutas where chofer_id = auth.uid())
  );

-- =====================================================================
-- RECOLECCIONES (evidencia del chofer)
-- =====================================================================
drop policy if exists recolecciones_personal on public.recolecciones;
create policy recolecciones_personal on public.recolecciones
  for all to authenticated
  using (es_personal()) with check (es_personal());

-- El operador levanta la evidencia de sus propias paradas.
drop policy if exists recolecciones_del_operador on public.recolecciones;
create policy recolecciones_del_operador on public.recolecciones
  for all to authenticated
  using (operador_id = auth.uid())
  with check (
    operador_id = auth.uid()
    and solicitud_id in (
      select s.id from public.solicitudes_recoleccion s
      join public.rutas r on r.id = s.ruta_id
      where r.chofer_id = auth.uid()
    )
  );

-- El cliente ve la evidencia de SUS recolecciones. Es su comprobante.
drop policy if exists recolecciones_del_cliente on public.recolecciones;
create policy recolecciones_del_cliente on public.recolecciones
  for select to authenticated
  using (
    solicitud_id in (
      select id from public.solicitudes_recoleccion where cliente_id = mi_cliente()
    )
  );

-- =====================================================================
-- MOVIMIENTOS DE SALDO — aquí hay dinero, así que se aprieta más.
-- =====================================================================
drop policy if exists movimientos_lee_personal on public.movimientos_saldo;
create policy movimientos_lee_personal on public.movimientos_saldo
  for select to authenticated using (es_personal());

drop policy if exists movimientos_crea_personal on public.movimientos_saldo;
create policy movimientos_crea_personal on public.movimientos_saldo
  for insert to authenticated with check (es_personal());

-- VERIFICAR un pago (darlo por bueno) queda reservado al dueño.
drop policy if exists movimientos_verifica_dueno on public.movimientos_saldo;
create policy movimientos_verifica_dueno on public.movimientos_saldo
  for update to authenticated
  using (es_dueno()) with check (es_dueno());

drop policy if exists movimientos_del_cliente on public.movimientos_saldo;
create policy movimientos_del_cliente on public.movimientos_saldo
  for select to authenticated
  using (cliente_id = mi_cliente());

-- El cliente sube su comprobante: nace SIEMPRE como abono pendiente.
-- No puede meterse un movimiento ya verificado.
drop policy if exists movimientos_sube_el_cliente on public.movimientos_saldo;
create policy movimientos_sube_el_cliente on public.movimientos_saldo
  for insert to authenticated
  with check (
    cliente_id = mi_cliente() and tipo = 'abono' and estado = 'pendiente'
  );

-- =====================================================================
-- ZONAS PEDIDAS
-- Las escribe el servidor (llave de servicio) cuando alguien queda fuera de
-- cobertura, porque esa persona todavía NO tiene cuenta. Aquí solo se abre
-- la lectura al personal.
-- =====================================================================
drop policy if exists zonas_pedidas_personal on public.zonas_pedidas;
create policy zonas_pedidas_personal on public.zonas_pedidas
  for all to authenticated
  using (es_personal()) with check (es_personal());

-- =====================================================================
-- BITÁCORA — se lee, no se corrige.
-- Nadie puede editar ni borrar: una bitácora que se puede alterar no sirve
-- de nada. Se escribe desde el servidor con la llave de servicio.
-- =====================================================================
drop policy if exists bitacora_lee_dueno on public.bitacora;
create policy bitacora_lee_dueno on public.bitacora
  for select to authenticated using (es_personal());
