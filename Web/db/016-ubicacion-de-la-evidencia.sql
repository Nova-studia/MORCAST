-- =====================================================================
--  016 · La ubicación de la evidencia, ahora de verdad
--
--  QUÉ PASABA
--  El comprobante de servicio mostraba un sello "GPS" en cada foto y un
--  renglón "Ubicación". No había NADA detrás: esta tabla nunca tuvo
--  columnas de coordenadas y la app del chofer nunca las pidió. Con datos
--  reales el renglón enseñaba el texto fijo "Registrado en la recolección";
--  las únicas coordenadas de verdad estaban escritas a mano en los datos de
--  demostración, y por eso en la demo se veía convincente.
--
--  Ese comprobante es lo que el cliente puede usar como respaldo de que el
--  camión estuvo en su domicilio. El sello se quitó en cuanto se detectó, y
--  esta migración es lo que permite devolverlo con algo atrás.
--
--  POR QUÉ jsonb Y NO CUATRO COLUMNAS
--  Se guarda una lectura POR FOTO, no una por recolección: el antes y el
--  después ocurren con media hora de diferencia y el sello se enseña en cada
--  foto. Con columnas sueltas serían seis (lat, lng y precisión × 2) y
--  cualquier dato nuevo pediría otra migración. El esquema ya usa jsonb para
--  lo que tiene forma propia (`rutas.zona`, `suscripciones.equipo`).
--
--  Forma del objeto:
--    {
--      "antes":   { "lat": 25.8693, "lng": -97.5023, "precision_m": 12,
--                   "capturada": "2026-08-26T14:12:03.000Z" },
--      "despues": { ... }
--    }
--  Cualquiera de las dos llaves puede faltar, y esa ausencia SIGNIFICA algo:
--  que no hubo señal o que el chofer no dio el permiso. Se enseña como
--  "sin ubicación", no se disimula.
--
--  LA PRECISIÓN SE GUARDA A PROPÓSITO
--  Una lectura con 2 km de error no prueba que el camión estuvo en el
--  domicilio: prueba que estuvo en la ciudad. Sin el margen, un dato malo se
--  ve igual de firme que uno bueno. Con él, la pantalla puede decidir si
--  vale como respaldo, y el cliente ve de qué tamaño es la afirmación.
--
--  NO SE VALIDA EL RANGO EN LA BASE a propósito. Un lat/lng fuera de
--  Matamoros no es dato corrupto: puede ser un chofer cubriendo otra plaza,
--  una prueba, o un teléfono con la ubicación falseada. Rechazarlo aquí
--  perdería la evidencia de que algo raro pasó, que es justo lo que uno
--  querría poder revisar después.
-- =====================================================================

alter table public.recolecciones
  add column if not exists ubicacion jsonb;

comment on column public.recolecciones.ubicacion is
  'Lectura de GPS por foto: {"antes":{lat,lng,precision_m,capturada},"despues":{...}}. '
  'Una llave ausente significa que no hubo señal o el chofer no dio permiso; '
  'eso se enseña como "sin ubicación", no se disimula. La precisión en metros '
  'se guarda porque una lectura con kilómetros de error no respalda nada.';

-- No lleva índice: este dato se LEE junto con su recolección y nunca se
-- consulta por él. Un índice aquí sería costo de escritura sin lectura que
-- lo aproveche.

-- ---------------------------------------------------------------------
-- PERMISOS
-- ---------------------------------------------------------------------
-- No hacen falta políticas nuevas. Las de `recolecciones` (002-rls.sql y
-- 012-la-evidencia-no-se-borra.sql) trabajan por FILA, así que la columna
-- nueva queda cubierta por lo que ya existe: el chofer inserta la suya, el
-- cliente lee las de sus propios servicios y el personal las ve todas.
--
-- Se deja anotado porque es justo el punto donde se cometen errores:
-- agregar una columna sensible y suponer que hereda permisos cuando la
-- política estaba escrita columna por columna. Aquí NO lo está — conviene
-- volver a comprobarlo si algún día esas políticas se reescriben.
