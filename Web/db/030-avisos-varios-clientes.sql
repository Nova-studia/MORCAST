-- =====================================================================
--  030 · AVISOS A VARIOS CLIENTES ELEGIDOS UNO POR UNO (9-oct-2026)
--  Se corre DESPUÉS de 029. Pedido de Luis: "que se puedan seleccionar uno
--  por uno". Nuevo alcance 'clientes' con la lista en `cliente_ids`.
--  'cliente' (uno solo) se queda tal cual: lo usa la app 1.1.1 y un aviso a
--  UN cliente elegido se sigue guardando así.
-- =====================================================================
begin;

alter table public.avisos add column if not exists cliente_ids uuid[];

alter table public.avisos drop constraint if exists avisos_alcance_check;
alter table public.avisos add constraint avisos_alcance_check
  check (alcance in ('todos', 'sector', 'ruta', 'cliente', 'clientes'));

alter table public.avisos drop constraint if exists avisos_check;
alter table public.avisos add constraint avisos_check check (
  (alcance = 'todos'    and sector_id is null and ruta_id is null and cliente_id is null and cliente_ids is null) or
  (alcance = 'sector'   and sector_id is not null) or
  (alcance = 'ruta'     and ruta_id is not null) or
  (alcance = 'cliente'  and cliente_id is not null) or
  (alcance = 'clientes' and coalesce(array_length(cliente_ids, 1), 0) between 1 and 500)
);

-- El cliente ve también los avisos donde su empresa está en la lista.
drop policy if exists avisos_lee_cliente on public.avisos;
create policy avisos_lee_cliente on public.avisos
  for select to authenticated
  using (
    mi_cliente() is not null and (
      alcance = 'todos'
      or (alcance = 'cliente'  and cliente_id = mi_cliente())
      or (alcance = 'clientes' and mi_cliente() = any (cliente_ids))
      or (alcance = 'ruta'     and ruta_id    in (select public.mis_rutas_activas()))
      or (alcance = 'sector'   and sector_id  in (select public.mis_sectores()))
    )
  );

commit;
