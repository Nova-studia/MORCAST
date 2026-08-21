-- =====================================================================
--  012 · El chofer NO puede borrar su propia evidencia
--
--  Encontrado en la prueba extremo a extremo del 21-ago-2026, con la
--  sesión real del chofer: pudo BORRAR la fila de `recolecciones` de una
--  parada que él mismo cerró.
--
--  La causa es una sola palabra. La política se escribió así:
--
--      create policy recolecciones_del_operador on public.recolecciones
--        for all to authenticated
--        using (operador_id = auth.uid()) ...
--
--  `for all` incluye DELETE. La intención era "que levante SU evidencia",
--  no "que la desaparezca".
--
--  Lo que pasaba al borrarla, y por eso importa:
--    · Las FOTOS sí están protegidas (la 008 solo deja borrar al personal),
--      así que quedaban huérfanas en la cubeta, sin fila que las apuntara.
--    · El servicio seguía diciendo `completada` para el cliente, pero
--      `rutaDelDia` calcula el estatus a partir de la evidencia, así que al
--      chofer le REAPARECÍA como "pendiente". Cliente y chofer viendo cosas
--      distintas del mismo servicio.
--    · Y se perdía justo lo que sirve para defenderse de una queja: el peso,
--      el código del contenedor y las horas.
--
--  Regla del proyecto, ya escrita cuando se hizo el Storage: una evidencia
--  que el chofer puede borrar no es evidencia. Aquí se aplica también a la
--  tabla, que era donde faltaba.
--
--  Se parte la política en tres verbos explícitos. El operador sigue
--  pudiendo leer, crear y corregir lo suyo; borrar, no. El personal
--  (dueño/admin) conserva el borrado por `recolecciones_personal`, que ya
--  existe y no se toca: alguien tiene que poder limpiar un error real.
-- =====================================================================

drop policy if exists recolecciones_del_operador on public.recolecciones;

-- ---------------------------------------------------------------------
--  Leer: solo lo que él levantó
-- ---------------------------------------------------------------------
drop policy if exists recolecciones_lee_operador on public.recolecciones;
create policy recolecciones_lee_operador on public.recolecciones
  for select to authenticated
  using (operador_id = auth.uid());

-- ---------------------------------------------------------------------
--  Crear: a su nombre y solo en paradas de SUS rutas
-- ---------------------------------------------------------------------
drop policy if exists recolecciones_crea_operador on public.recolecciones;
create policy recolecciones_crea_operador on public.recolecciones
  for insert to authenticated
  with check (
    operador_id = auth.uid()
    and solicitud_id in (
      select s.id from public.solicitudes_recoleccion s
      join public.rutas r on r.id = s.ruta_id
      where r.chofer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
--  Corregir: puede arreglar un peso mal tecleado, pero la evidencia
--  sigue siendo suya y de esa parada. No puede pasársela a otro.
-- ---------------------------------------------------------------------
drop policy if exists recolecciones_corrige_operador on public.recolecciones;
create policy recolecciones_corrige_operador on public.recolecciones
  for update to authenticated
  using (operador_id = auth.uid())
  with check (
    operador_id = auth.uid()
    and solicitud_id in (
      select s.id from public.solicitudes_recoleccion s
      join public.rutas r on r.id = s.ruta_id
      where r.chofer_id = auth.uid()
    )
  );

-- Sin política de DELETE para el operador: eso es todo el arreglo.

-- =====================================================================
--  Cómo se comprueba (con la sesión real del chofer, no de memoria):
--
--    DELETE .../rest/v1/recolecciones?id=eq.<suyo>   -> debe dar 0 filas
--    GET    .../rest/v1/recolecciones?select=id      -> sigue viendo las suyas
--    POST   .../rest/v1/recolecciones                -> sigue pudiendo cerrar
--
--  Ojo al comprobarlo: un DELETE que el RLS bloquea NO da error. Responde
--  200 y borra cero. Hay que mirar cuántas filas devolvió, no el código.
-- =====================================================================
