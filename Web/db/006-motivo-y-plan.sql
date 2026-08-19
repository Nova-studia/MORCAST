-- =====================================================================
--  MORCAST — Dos columnas que piden las pantallas de recolecciones y clientes
--  Se corre DESPUÉS de 005.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Por qué se rechazó una recolección.
--
--    Va aparte de `nota`: la nota la escribe el CLIENTE al pedir el
--    servicio ("se juntó residuo por un evento"), y el motivo lo escribe
--    MORCAST al rechazar ("sin cupo en la ruta ese día"). Meterlos en el
--    mismo campo haría que uno pisara al otro.
-- ---------------------------------------------------------------------
alter table public.solicitudes_recoleccion
  add column if not exists motivo_rechazo text;

-- ---------------------------------------------------------------------
-- 2) El tipo de trato con el cliente: "Contrato anual", "Por evento"…
--    Es texto libre a propósito: hoy son tres, mañana Morcast inventará
--    otro, y no vale la pena obligarlos a pedir un cambio de sistema para
--    eso.
-- ---------------------------------------------------------------------
alter table public.clientes
  add column if not exists plan text;

-- ---------------------------------------------------------------------
--  NOTA sobre el SALDO, que aquí NO se agrega a propósito:
--
--  El saldo y lo que está por pagar NO se guardan como columnas. Se
--  calculan sumando `movimientos_saldo`. Un saldo guardado aparte es un
--  número que hay que acordarse de actualizar en cada movimiento, y el día
--  que alguien se olvide (o falle a la mitad), el saldo deja de cuadrar con
--  sus propios movimientos y nadie sabe cuál de los dos mentía.
--
--  Si algún día son tantos movimientos que la suma pesa, la salida es una
--  vista materializada, no una columna suelta.
-- ---------------------------------------------------------------------
