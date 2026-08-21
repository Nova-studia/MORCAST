-- =====================================================================
--  014 · Tres detalles de la prueba del 21-ago-2026
--
--  Ninguno le hace daño a nadie hoy. Los tres son de los que se vuelven
--  caros el día que haya movimiento de verdad.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1 · El chofer no tiene por qué ver el saldo de los clientes
--
--  `saldos_clientes` es una vista con `security_invoker`, así que hereda
--  el permiso de `clientes`. Y desde la 011 el chofer ve a los clientes
--  de sus paradas: de rebote le llegaba también cuánto deben y cuánto
--  tienen a favor. Probado con su sesión el 21-ago: una fila con saldo.
--
--  Su trabajo es recoger, no cobrar. Se acota a quien sí le toca: el
--  personal y el propio cliente.
-- ---------------------------------------------------------------------
create or replace view public.saldos_clientes
with (security_invoker = true) as
  select
    c.id as cliente_id,
    c.folio,
    c.empresa,
    coalesce(sum(m.monto) filter (where m.tipo = 'abono' and m.estado = 'aplicada'), 0::numeric)
      - coalesce(sum(m.monto) filter (where m.tipo = 'cargo'), 0::numeric) as saldo,
    coalesce(sum(m.monto) filter (where m.tipo = 'cargo'), 0::numeric) as cargos,
    coalesce(sum(m.monto) filter (where m.tipo = 'abono' and m.estado = 'por-verificar'), 0::numeric) as por_verificar
  from public.clientes c
  left join public.movimientos_saldo m on m.cliente_id = c.id
  where public.es_personal() or c.id = public.mi_cliente()
  group by c.id, c.folio, c.empresa;

-- ---------------------------------------------------------------------
--  2 · Las rutas: cada quien las suyas
--
--  `rutas_lectura` era `using (true)`: cualquiera con sesión veía las
--  TRES rutas enteras, incluidos `chofer` y `chofer_id`. Un cliente no
--  tiene por qué saber quién maneja qué.
--
--  Ojo con no pasarse de listo: el cliente SÍ necesita su propia ruta
--  (para saber qué días pasa el camión y para pedir su recolección). Y el
--  mapa de cobertura del portal necesita TODAS las zonas — eso se
--  resuelve del lado del servidor con `zonasDeCobertura()`, que devuelve
--  solo clave, nombre, tipo, días y polígono, sin chofer ni unidad. Es la
--  misma vía que ya usaba la página pública de alta.
-- ---------------------------------------------------------------------
create or replace function public.mis_rutas()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.ruta_id
  from public.suscripciones s
  where s.cliente_id = public.mi_cliente()
    and s.ruta_id is not null
$$;

revoke all on function public.mis_rutas() from public;
grant execute on function public.mis_rutas() to authenticated;

drop policy if exists rutas_lectura on public.rutas;
create policy rutas_lectura on public.rutas
  for select to authenticated
  using (
    es_personal()
    or chofer_id = auth.uid()
    or id in (select public.mis_rutas())
  );

-- ---------------------------------------------------------------------
--  3 · El folio del cliente, sin carrera
--
--  `crearCliente` leía el folio más alto y luego insertaba. Entre una
--  cosa y otra cabe otra alta: las dos calculan el mismo número y la
--  segunda choca contra `clientes_folio_key`. Hoy es improbable —los
--  clientes se dan de alta de uno en uno— pero el día que se capturen
--  varios a la vez, alguien va a ver un error que no entiende.
--
--  Se asigna dentro de la propia inserción, con un candado que serializa
--  solo esto. Quien inserte sin folio lo recibe puesto; quien lo mande
--  explícito (una migración de datos, un respaldo) conserva el suyo.
-- ---------------------------------------------------------------------
create or replace function public.asignar_folio_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  anio text := to_char(now(), 'YYYY');
  ultimo int;
begin
  if new.folio is not null and new.folio <> '' then
    return new;
  end if;

  -- Candado de asesoría: dos altas simultáneas se forman en fila para
  -- esta línea y nada más. Se libera solo al terminar la transacción.
  perform pg_advisory_xact_lock(hashtext('folio_cliente_' || anio));

  select coalesce(max(split_part(folio, '-', 3)::int), 0)
    into ultimo
    from public.clientes
   where folio like 'MOR-' || anio || '-%'
     and split_part(folio, '-', 3) ~ '^[0-9]+$';

  new.folio := 'MOR-' || anio || '-' || lpad((ultimo + 1)::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists clientes_folio on public.clientes;
create trigger clientes_folio
  before insert on public.clientes
  for each row execute function public.asignar_folio_cliente();

-- =====================================================================
--  Cómo se comprueba:
--
--   · chofer:  GET .../saldos_clientes  -> 0 filas
--              GET .../rutas            -> solo las suyas
--   · cliente: GET .../rutas            -> solo la de su suscripción
--              GET .../saldos_clientes  -> la suya, sigue viéndola
--   · dueño:   las tres rutas y todos los saldos, como siempre
--   · folio:   insertar dos clientes sin folio en paralelo -> MOR-AAAA-000N
--              y MOR-AAAA-000N+1, ninguno choca
-- =====================================================================
