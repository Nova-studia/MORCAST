-- =====================================================================
--  MORCAST — El chofer necesita poder cerrar su propia parada
--  Se corre DESPUÉS de 008.
-- =====================================================================
--
--  QUÉ SE ROMPIÓ
--  -------------
--  El chofer terminó una recolección: se subieron las dos fotos, se guardó
--  el peso y el código del contenedor... y el servicio siguió apareciendo
--  como "confirmada" en vez de "completada". Sin ningún error en pantalla.
--
--  Motivo: en 002-rls.sql le di al operador permiso de SELECT sobre las
--  solicitudes de su ruta, pero ninguno de UPDATE. Se me pasó que el chofer
--  no solo consulta su ruta: la va cerrando conforme trabaja.
--
--  ⚠️ LO IMPORTANTE, Y LA RAZÓN DE QUE NO SE VIERA:
--  Un UPDATE bloqueado por RLS **no da error**. Postgres no dice "no
--  puedes"; simplemente no encuentra ninguna fila que te toque y actualiza
--  cero. La respuesta es "todo bien". Por eso el código creía que había
--  cerrado el servicio.
--
--  Se arregla en los dos lados: aquí se da el permiso, y en
--  lib/datos-chofer.js se pasó a comprobar cuántas filas cambiaron de verdad
--  en vez de confiar en que no hubo error.
-- =====================================================================

-- El operador puede mover SUS paradas, y solo entre los estados que le
-- corresponden mientras trabaja.
--
-- No puede confirmar (eso lo decide Morcast), ni rechazar, ni regresar una
-- completada a pendiente. Solo el camino natural de su jornada:
-- confirmada → en-ruta → completada.
drop policy if exists solicitudes_cierra_operador on public.solicitudes_recoleccion;
create policy solicitudes_cierra_operador on public.solicitudes_recoleccion
  for update to authenticated
  using (
    mi_rol() = 'operador'
    and ruta_id in (select id from public.rutas where chofer_id = auth.uid())
    and estado in ('confirmada', 'en-ruta')
  )
  with check (
    ruta_id in (select id from public.rutas where chofer_id = auth.uid())
    and estado in ('en-ruta', 'completada')
  );
