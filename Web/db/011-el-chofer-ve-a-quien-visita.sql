-- =====================================================================
--  011 · El chofer puede ver A QUIÉN visita y DÓNDE
--
--  El problema, encontrado probando con la sesión real del chofer:
--  su pantalla listaba las paradas del día pero cada una decía "—" en el
--  cliente y "Sin domicilio registrado" en la dirección. O sea: un chofer
--  que no sabe a nombre de quién va ni a qué calle.
--
--  La causa NO estaba en la pantalla. `lib/datos-chofer.js` sí pide
--  `clientes ( empresa )` y `domicilios ( alias, calle, colonia )`, pero el
--  operador no tenía NINGUNA política sobre esas dos tablas, así que el RLS
--  devolvía el enlace en nulo. Y como un SELECT vacío no es un error, la
--  pantalla pintaba sus valores de respaldo sin que nada tronara.
--
--  Se le abre lo justo: solo las empresas y domicilios que aparecen en una
--  solicitud de UNA RUTA SUYA. No la cartera de clientes de Morcast.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Los clientes que están en alguna parada de sus rutas
-- ---------------------------------------------------------------------
drop policy if exists clientes_del_operador on public.clientes;

create policy clientes_del_operador
  on public.clientes
  for select
  to authenticated
  using (
    public.mi_rol() = 'operador'
    and id in (
      select s.cliente_id
      from public.solicitudes_recoleccion s
      join public.rutas r on r.id = s.ruta_id
      where r.chofer_id = auth.uid()
        and s.estado in ('confirmada', 'en-ruta', 'completada')
    )
  );

-- ---------------------------------------------------------------------
--  Y el domicilio al que tiene que llegar
-- ---------------------------------------------------------------------
drop policy if exists domicilios_del_operador on public.domicilios;

create policy domicilios_del_operador
  on public.domicilios
  for select
  to authenticated
  using (
    public.mi_rol() = 'operador'
    and id in (
      select s.domicilio_id
      from public.solicitudes_recoleccion s
      join public.rutas r on r.id = s.ruta_id
      where r.chofer_id = auth.uid()
        and s.estado in ('confirmada', 'en-ruta', 'completada')
    )
  );

-- ---------------------------------------------------------------------
--  NOTA sobre el alcance
--
--  El RLS es por FILA, no por columna: mientras la fila sea visible, el
--  operador podría pedir por la API cualquier columna de `clientes`,
--  incluidos el RFC y la línea de crédito. La pantalla solo pide `empresa`.
--
--  Se deja así a propósito: el chofer es personal de Morcast y esos datos
--  ya los tiene la empresa. Si algún día conviene apretarlo, la forma
--  correcta NO es quitar la política, sino crear una vista con las tres
--  columnas que la pantalla usa y apuntar `datos-chofer.js` ahí.
-- ---------------------------------------------------------------------
