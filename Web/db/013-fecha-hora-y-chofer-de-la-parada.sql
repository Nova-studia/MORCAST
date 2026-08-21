-- =====================================================================
--  013 · Fecha con sentido, hora de la visita, y chofer por parada
--
--  Tres cosas de la prueba extremo a extremo del 21-ago-2026:
--
--  1. NO HABÍA VALIDACIÓN DE FECHA. Con la sesión real de un cliente se
--     metió una recolección para el 15 de enero de 2020 y la base la
--     aceptó. El `<input type="date">` no tenía `min` y nadie miraba la
--     fecha en el servidor. Poner `min` en la pantalla no alcanza: se
--     quita con las herramientas del navegador, y quien tiene sesión
--     puede hablarle a la API directo, que es justo como se encontró.
--
--  2. NO SE PODÍA DECIR A QUÉ HORA. El cliente veía "22 de agosto" y
--     nada más, así que tenía que esperar el camión todo el día.
--
--  3. NO SE PODÍA ASIGNAR CHOFER. El chofer salía de la RUTA, así que si
--     alguien falta y otro tiene que cubrir su ruta, no había manera.
--
--  La fecha se valida donde no se puede esquivar: en la política que deja
--  al cliente pedir. Se acepta desde AYER a propósito, no desde hoy:
--  `current_date` en Postgres va en UTC y Matamoros está seis horas
--  atrás, así que a las 7 de la tarde de aquí allá ya es mañana. Un día
--  de holgura no le sirve a nadie para colar basura y evita rechazar una
--  solicitud legítima de hoy.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1 · Columnas nuevas
-- ---------------------------------------------------------------------
alter table public.solicitudes_recoleccion
  add column if not exists hora_confirmada time,
  -- Chofer asignado a ESTA parada. Nulo = el de la ruta, que es como
  -- funcionaba hasta hoy y sigue siendo lo normal. Se llena solo cuando
  -- hay que salirse de la ruta (una cobertura, un extra).
  add column if not exists chofer_id uuid references public.perfiles(id) on delete set null;

comment on column public.solicitudes_recoleccion.hora_confirmada is
  'Hora acordada con el cliente. Nula = solo se comprometió el día.';
comment on column public.solicitudes_recoleccion.chofer_id is
  'Chofer asignado a esta parada. Nulo = el que trae la ruta.';

-- ---------------------------------------------------------------------
--  2 · Las paradas que le tocan al operador
--
--  Antes esto estaba escrito cinco veces, siempre igual: "las rutas cuyo
--  chofer_id soy yo". Ahora son dos caminos (por ruta o por asignación
--  directa) y repetirlo cinco veces es pedir que se desincronicen.
--
--  Va como SECURITY DEFINER con `search_path` fijo, igual que `mi_rol` y
--  `mi_cliente`: si no, una política SOBRE solicitudes_recoleccion
--  tendría que leer solicitudes_recoleccion para poder leerla, y eso es
--  recursión infinita.
-- ---------------------------------------------------------------------
create or replace function public.mis_paradas()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.solicitudes_recoleccion s
  left join public.rutas r on r.id = s.ruta_id
  where r.chofer_id = auth.uid()
     or s.chofer_id = auth.uid()
$$;

revoke all on function public.mis_paradas() from public;
grant execute on function public.mis_paradas() to authenticated;

-- ---------------------------------------------------------------------
--  3 · El cliente pide: con fecha que exista de verdad
-- ---------------------------------------------------------------------
drop policy if exists solicitudes_pide_el_cliente on public.solicitudes_recoleccion;
create policy solicitudes_pide_el_cliente on public.solicitudes_recoleccion
  for insert to authenticated
  with check (
    cliente_id = mi_cliente()
    and estado = 'solicitada'
    -- Ni el pasado ni un año adelante. Lo segundo no es paranoia: un
    -- dedazo en el año ("2062") ensucia la agenda para siempre.
    and fecha_pedida >= (current_date - 1)
    and fecha_pedida <= (current_date + 365)
  );

-- ---------------------------------------------------------------------
--  4 · El operador ve y cierra SUS paradas (por ruta o asignadas)
-- ---------------------------------------------------------------------
drop policy if exists solicitudes_del_operador on public.solicitudes_recoleccion;
create policy solicitudes_del_operador on public.solicitudes_recoleccion
  for select to authenticated
  using (mi_rol() = 'operador' and id in (select public.mis_paradas()));

drop policy if exists solicitudes_cierra_operador on public.solicitudes_recoleccion;
create policy solicitudes_cierra_operador on public.solicitudes_recoleccion
  for update to authenticated
  using (
    mi_rol() = 'operador'
    and id in (select public.mis_paradas())
    and estado in ('confirmada', 'en-ruta')
  )
  with check (
    id in (select public.mis_paradas())
    and estado in ('en-ruta', 'completada')
  );

-- ---------------------------------------------------------------------
--  5 · Y ve a quién visita, también en las paradas asignadas
-- ---------------------------------------------------------------------
drop policy if exists clientes_del_operador on public.clientes;
create policy clientes_del_operador on public.clientes
  for select to authenticated
  using (
    mi_rol() = 'operador'
    and id in (
      select s.cliente_id from public.solicitudes_recoleccion s
      where s.id in (select public.mis_paradas())
        and s.estado in ('confirmada', 'en-ruta', 'completada')
    )
  );

drop policy if exists domicilios_del_operador on public.domicilios;
create policy domicilios_del_operador on public.domicilios
  for select to authenticated
  using (
    mi_rol() = 'operador'
    and id in (
      select s.domicilio_id from public.solicitudes_recoleccion s
      where s.id in (select public.mis_paradas())
        and s.estado in ('confirmada', 'en-ruta', 'completada')
    )
  );

-- ---------------------------------------------------------------------
--  6 · Y levanta evidencia de las paradas asignadas (012 seguía atada
--      solo a la ruta, así que un chofer de cobertura no podía cerrar)
-- ---------------------------------------------------------------------
drop policy if exists recolecciones_crea_operador on public.recolecciones;
create policy recolecciones_crea_operador on public.recolecciones
  for insert to authenticated
  with check (operador_id = auth.uid() and solicitud_id in (select public.mis_paradas()));

drop policy if exists recolecciones_corrige_operador on public.recolecciones;
create policy recolecciones_corrige_operador on public.recolecciones
  for update to authenticated
  using (operador_id = auth.uid())
  with check (operador_id = auth.uid() and solicitud_id in (select public.mis_paradas()));

-- Sigue SIN política de DELETE para el operador (ver la 012).

-- ---------------------------------------------------------------------
--  7 · Y SUBE LAS FOTOS de las paradas asignadas
--
--  Esto salió probando, no leyendo: con la parada ya asignada, el chofer la
--  veía y podía cerrarla, pero la foto no llegaba a la cubeta. Las políticas
--  de Storage de la 008 seguían preguntando por la RUTA
--  (`join rutas r on r.id = s.ruta_id`), así que una parada con `ruta_id`
--  nulo y `chofer_id` puesto quedaba fuera. Media función sirve de poco: un
--  chofer de cobertura que no puede dejar evidencia no cubre nada.
-- ---------------------------------------------------------------------
drop policy if exists evidencias_sube_operador on storage.objects;
create policy evidencias_sube_operador on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and carpeta_uuid(name) in (select public.mis_paradas())
  );

drop policy if exists evidencias_lee_operador on storage.objects;
create policy evidencias_lee_operador on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidencias'
    and carpeta_uuid(name) in (select public.mis_paradas())
  );

-- =====================================================================
--  Cómo se comprueba, con las sesiones reales:
--
--   · cliente: POST solicitudes_recoleccion con fecha_pedida '2020-01-15'
--       -> 403. Con la fecha de mañana -> 201.
--   · chofer de la ruta: sigue viendo y cerrando sus paradas.
--   · chofer SIN la ruta pero con chofer_id = él: ve la parada, ve al
--       cliente y el domicilio, y puede cerrarla.
--
--  Ojo: un INSERT que el RLS bloquea da 403, pero un UPDATE bloqueado
--  responde 200 y cambia CERO filas. Hay que contar lo devuelto.
-- =====================================================================
