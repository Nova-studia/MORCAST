-- =====================================================================
--  MORCAST — Permisos de los archivos (fotos y comprobantes)
--  Se corre DESPUÉS de 007.
-- =====================================================================
--
--  Las dos cubetas ya están creadas y son PRIVADAS: sin URL firmada no se
--  abre nada, ni sabiendo la dirección exacta.
--
--  Pero "privada" solo significa que no hay enlace público. Quién puede
--  subir y quién puede pedir una URL firmada lo deciden estas políticas.
--  Sin ellas, cualquiera con sesión podría pedir la foto de cualquier
--  cliente.
--
--  CÓMO SE ORGANIZAN LOS ARCHIVOS (importante: las políticas dependen de esto)
--    evidencias/<id-de-la-solicitud>/antes.jpg
--    evidencias/<id-de-la-solicitud>/despues.jpg
--    comprobantes/<id-del-cliente>/<lo-que-sea>.jpg
--
--  La primera carpeta es la llave: de ahí se saca a quién pertenece el
--  archivo. Por eso el nombre no es decorativo, es parte del candado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Función de apoyo: la primera carpeta de la ruta, como uuid.
-- Devuelve null si no es un uuid válido, y entonces ninguna política
-- coincide y el acceso se niega. Fallar cerrado es lo correcto aquí.
-- ---------------------------------------------------------------------
create or replace function public.carpeta_uuid(ruta text)
returns uuid language plpgsql immutable as $$
begin
  return (storage.foldername(ruta))[1]::uuid;
exception when others then
  return null;
end;
$$;

-- =====================================================================
--  CUBETA "evidencias" — fotos de antes y después del chofer
-- =====================================================================

-- El personal de Morcast ve y hace todo.
drop policy if exists evidencias_personal on storage.objects;
create policy evidencias_personal on storage.objects
  for all to authenticated
  using (bucket_id = 'evidencias' and es_personal())
  with check (bucket_id = 'evidencias' and es_personal());

-- El operador SUBE solo a la carpeta de una recolección que sea de una ruta
-- que él maneja. No puede subir a la de otro aunque adivine el id.
drop policy if exists evidencias_sube_operador on storage.objects;
create policy evidencias_sube_operador on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and carpeta_uuid(name) in (
      select s.id
        from public.solicitudes_recoleccion s
        join public.rutas r on r.id = s.ruta_id
       where r.chofer_id = auth.uid()
    )
  );

-- Y las vuelve a ver, para revisar lo que subió.
drop policy if exists evidencias_lee_operador on storage.objects;
create policy evidencias_lee_operador on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidencias'
    and carpeta_uuid(name) in (
      select s.id
        from public.solicitudes_recoleccion s
        join public.rutas r on r.id = s.ruta_id
       where r.chofer_id = auth.uid()
    )
  );

-- El cliente ve ÚNICAMENTE las fotos de sus propias recolecciones.
-- Es su comprobante ambiental: tiene todo el derecho a verlas, y ninguno
-- a ver las de otra empresa.
drop policy if exists evidencias_lee_cliente on storage.objects;
create policy evidencias_lee_cliente on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidencias'
    and carpeta_uuid(name) in (
      select id from public.solicitudes_recoleccion where cliente_id = mi_cliente()
    )
  );

-- =====================================================================
--  CUBETA "comprobantes" — los pagos que sube el cliente
-- =====================================================================

drop policy if exists comprobantes_personal on storage.objects;
create policy comprobantes_personal on storage.objects
  for all to authenticated
  using (bucket_id = 'comprobantes' and es_personal())
  with check (bucket_id = 'comprobantes' and es_personal());

-- El cliente sube a SU carpeta y solo a la suya.
drop policy if exists comprobantes_sube_cliente on storage.objects;
create policy comprobantes_sube_cliente on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprobantes' and carpeta_uuid(name) = mi_cliente()
  );

drop policy if exists comprobantes_lee_cliente on storage.objects;
create policy comprobantes_lee_cliente on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes' and carpeta_uuid(name) = mi_cliente()
  );

-- ---------------------------------------------------------------------
--  NOTA: no se le da BORRAR a nadie más que al personal, a propósito.
--
--  Una evidencia que el propio chofer pueda borrar no es evidencia. Si se
--  equivocó de foto, sube otra y quedan las dos; Morcast decide cuál vale.
--  Lo mismo con los comprobantes de pago: el cliente no debería poder
--  hacer desaparecer el papel que ya mandó.
-- ---------------------------------------------------------------------
