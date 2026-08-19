-- =====================================================================
--  MORCAST — Saldos, recargas y cotizaciones
--  Se corre DESPUÉS de 006. Es la última migración prevista.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) MOVIMIENTOS DE SALDO
--
--    Le faltaban los datos del depósito. El flujo de Morcast no tiene pagos
--    en línea: el cliente transfiere por su cuenta y sube el comprobante, así
--    que hay que guardar de qué banco vino y con qué referencia, o no hay
--    forma de cuadrarlo contra el estado de cuenta.
-- ---------------------------------------------------------------------
alter table public.movimientos_saldo add column if not exists folio               text;
alter table public.movimientos_saldo add column if not exists banco               text;
alter table public.movimientos_saldo add column if not exists referencia          text;
alter table public.movimientos_saldo add column if not exists comprobante_nombre  text;
alter table public.movimientos_saldo add column if not exists notas               text;

-- Se adopta el vocabulario que ya usan las pantallas. "Aplicada" dice más que
-- "verificado": no es solo que alguien la revisó, es que ya cuenta en el saldo.
alter table public.movimientos_saldo drop constraint if exists movimientos_saldo_estado_check;
alter table public.movimientos_saldo add constraint movimientos_saldo_estado_check
  check (estado in ('por-verificar','aplicada','rechazada'));

alter table public.movimientos_saldo alter column estado set default 'por-verificar';

-- La política de inserción del cliente hablaba del estado viejo. Si no se
-- actualiza, el cliente ya no podría subir ningún comprobante.
drop policy if exists movimientos_sube_el_cliente on public.movimientos_saldo;
create policy movimientos_sube_el_cliente on public.movimientos_saldo
  for insert to authenticated
  with check (
    cliente_id = mi_cliente() and tipo = 'abono' and estado = 'por-verificar'
  );

-- ---------------------------------------------------------------------
-- 2) COTIZACIONES (las solicitudes del formulario público)
--
--    La tabla es anterior a todo esto y quedó con RLS encendido pero SIN
--    políticas, o sea: nadie podía leerla más que el servidor con la llave
--    de servicio. Bien para la privacidad —se comprobó que un visitante no
--    ve nada— pero el panel tampoco podía mostrarlas.
--
--    Se abre solo al personal de Morcast. Los prospectos que dejan su
--    teléfono en el formulario no tienen por qué ser visibles para nadie más.
-- ---------------------------------------------------------------------
alter table public.cotizaciones enable row level security;

drop policy if exists cotizaciones_personal on public.cotizaciones;
create policy cotizaciones_personal on public.cotizaciones
  for all to authenticated
  using (es_personal()) with check (es_personal());

-- ---------------------------------------------------------------------
-- 3) SALDO DE CADA CLIENTE, calculado.
--
--    Una vista, no una columna: el saldo siempre sale de sumar sus propios
--    movimientos, así que es imposible que se desincronice de ellos.
--
--    Solo cuentan los abonos APLICADOS. Un comprobante que Morcast todavía
--    no verifica no es dinero: es una foto de un papel.
-- ---------------------------------------------------------------------
create or replace view public.saldos_clientes
with (security_invoker = true) as
select
  c.id  as cliente_id,
  c.folio,
  c.empresa,
  coalesce(sum(m.monto) filter (where m.tipo = 'abono' and m.estado = 'aplicada'), 0)
    - coalesce(sum(m.monto) filter (where m.tipo = 'cargo'), 0) as saldo,
  coalesce(sum(m.monto) filter (where m.tipo = 'cargo'), 0)      as cargos,
  coalesce(sum(m.monto) filter (where m.tipo = 'abono' and m.estado = 'por-verificar'), 0)
    as por_verificar
from public.clientes c
left join public.movimientos_saldo m on m.cliente_id = c.id
group by c.id, c.folio, c.empresa;

-- `security_invoker = true` es lo que hace que la vista respete el RLS de
-- quien la consulta. Sin eso, una vista corre con los permisos de quien la
-- creó y cualquier cliente podría ver el saldo de todos los demás.
