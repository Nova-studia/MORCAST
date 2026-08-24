-- ---------------------------------------------------------------------
--  015 · La cobertura vuelve a ser toda la ciudad
--
--  QUÉ PASÓ
--
--  En la 014 se cerró `rutas_lectura` para que un cliente dejara de ver las
--  TRES rutas con su chofer y su unidad. Eso estuvo bien: no es asunto suyo
--  quién maneja qué.
--
--  Pero el mapa de COBERTURA necesita las zonas de todas las rutas: es la
--  pantalla donde el cliente pregunta "¿me llegan a mi sucursal?". Al
--  cerrarse la tabla, esa pantalla pasó a ver una sola zona —la de su propia
--  ruta— y el mapa se encogió de toda Matamoros a un pedazo.
--
--  En la web se resolvió del lado del servidor con `zonasDeCobertura()`, que
--  usa la llave de servicio. La APP no tiene servidor: habla directo con la
--  base, así que ahí no había forma y la cobertura quedó chica.
--
--  LA SALIDA
--
--  Una función que devuelve SOLO lo que ese mapa dibuja: clave, nombre,
--  tipo, días y polígono. Nada de `chofer`, `chofer_id`, `unidad` ni `cupo`.
--  La zona no es un secreto —es justo lo que se le presume al cliente—; lo
--  operativo sí, y por eso no sale.
--
--  Al ser `security definer` esquiva el RLS de `rutas`, que es el punto. Por
--  eso devuelve columnas fijas en vez de la fila entera: así, si mañana se le
--  agrega un campo sensible a `rutas`, esta función NO empieza a publicarlo
--  sola.
-- ---------------------------------------------------------------------

create or replace function public.zonas_cobertura()
returns table (
  id     uuid,
  clave  text,
  nombre text,
  tipo   text,
  dias   text[],
  zona   jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.clave, r.nombre, r.tipo, r.dias, r.zona
  from public.rutas r
  where r.activa
    -- Un polígono de menos de tres puntos no es un área: no se dibuja y
    -- solo haría que el mapa calculara sobre basura.
    and jsonb_array_length(r.zona) >= 3
  order by r.clave
$$;

revoke all on function public.zonas_cobertura() from public;
grant execute on function public.zonas_cobertura() to authenticated;

comment on function public.zonas_cobertura() is
  'Zonas de cobertura para el mapa del portal y de la app. Esquiva el RLS de rutas a propósito, pero solo entrega lo que el mapa dibuja: sin chofer, unidad ni cupo.';
