-- =====================================================================
--  031 · FOLIO DE LA BASE Y UNA SOLA EVIDENCIA POR PARADA (9-oct-2026)
--  Se corre DESPUÉS de 030. Entrega 3 (docs/superpowers/plans/2026-10-09-entrega-3-operacion.md).
--
--  Ojo: las apps 1.1.1 ya instaladas (1) mandan un folio calculado por ellas
--  y (2) cierran la parada con un INSERT directo a `recolecciones`, sin
--  reintento automático. Todo lo de aquí funciona con ellas tal como están.
-- =====================================================================
begin;

-- ---------------------------------------------------------- folio
-- El cliente solo ve SUS folios, así que el "máximo + 1" que calculan el
-- portal y las apps choca con el de otro cliente (REC-2026-0001 para todos).
-- La base decide: si viene vacío o ya existe, pone el siguiente libre; un
-- folio libre se respeta (la app lo usa después para avisar a la oficina).
create or replace function public.asignar_folio_solicitud()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  anio   text := to_char(now() at time zone 'America/Matamoros', 'YYYY');
  ultimo integer;
  sig    text;
begin
  perform pg_advisory_xact_lock(hashtext('folio_solicitud_' || anio));
  if new.folio is not null and btrim(new.folio) <> ''
     and not exists (select 1 from public.solicitudes_recoleccion where folio = new.folio) then
    return new;
  end if;
  select coalesce(max(split_part(folio, '-', 3)::integer), 0) into ultimo
    from public.solicitudes_recoleccion
   where folio like 'REC-' || anio || '-%' and split_part(folio, '-', 3) ~ '^[0-9]{1,9}$';
  sig := (ultimo + 1)::text;
  new.folio := 'REC-' || anio || '-' || lpad(sig, greatest(4, length(sig)), '0');
  return new;
end;
$$;

drop trigger if exists solicitudes_folio on public.solicitudes_recoleccion;
create trigger solicitudes_folio before insert on public.solicitudes_recoleccion
  for each row execute function public.asignar_folio_solicitud();

-- ---------------------------------------------------------- una evidencia por parada
do $$
begin
  if exists (select solicitud_id from public.recolecciones group by solicitud_id having count(*) > 1) then
    raise exception 'Hay paradas con evidencia duplicada: hay que limpiarlas antes de la 031 (avísale a Claude).';
  end if;
end;
$$;

-- Un segundo cierre de la MISMA parada (doble toque, reintento tras una
-- respuesta perdida) no truena ni duplica: actualiza la evidencia que ya
-- había con lo nuevo que no venga vacío y descarta el INSERT. Así la app
-- sigue y puede marcar la parada como completada.
create or replace function public.evidencia_una_por_parada()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  previa public.recolecciones;
begin
  -- Un chofer solo cierra paradas vivas (nunca una "No procedió").
  if auth.uid() is not null and not es_personal() and not exists (
       select 1 from public.solicitudes_recoleccion s
        where s.id = new.solicitud_id and s.estado in ('confirmada', 'en-ruta', 'completada')) then
    raise exception 'Esta parada ya no se puede cerrar (está cancelada o marcada como No procedió).';
  end if;

  select * into previa from public.recolecciones where solicitud_id = new.solicitud_id limit 1 for update;
  if not found then
    return new;
  end if;

  if auth.uid() is not null and not es_personal() and previa.operador_id is distinct from new.operador_id then
    raise exception 'Esta recolección ya la cerró otro chofer.';
  end if;

  update public.recolecciones set
    qr           = coalesce(new.qr, previa.qr),
    peso_kg      = coalesce(new.peso_kg, previa.peso_kg),
    foto_antes   = coalesce(new.foto_antes, previa.foto_antes),
    foto_despues = coalesce(new.foto_despues, previa.foto_despues),
    hora_antes   = coalesce(new.hora_antes, previa.hora_antes),
    hora_despues = coalesce(new.hora_despues, previa.hora_despues),
    ubicacion    = coalesce(new.ubicacion, previa.ubicacion)
  where id = previa.id;
  return null;
end;
$$;

drop trigger if exists evidencia_una_por_parada_tg on public.recolecciones;
create trigger evidencia_una_por_parada_tg before insert on public.recolecciones
  for each row execute function public.evidencia_una_por_parada();

-- El respaldo por si dos cierres llegan en el mismo instante.
create unique index if not exists recolecciones_solicitud_unica on public.recolecciones (solicitud_id);

-- La política del chofer también pide que la parada siga viva.
drop policy if exists recolecciones_crea_operador on public.recolecciones;
create policy recolecciones_crea_operador on public.recolecciones
  for insert to authenticated
  with check (
    operador_id = auth.uid()
    and solicitud_id in (select public.mis_paradas())
    and exists (select 1 from public.solicitudes_recoleccion s
                 where s.id = solicitud_id and s.estado in ('confirmada', 'en-ruta', 'completada'))
  );

commit;
