# Entrar con gafete (NFC) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El personal de Morcast entra a las apps de Android y iPhone acercando su gafete NFC, solo en el teléfono donde lo vinculó; el panel puede desvincular.

**Architecture:** El servidor (Next.js en `Web/`) guarda, por cada par gafete–teléfono, el hash de un secreto que vive en SecureStore del teléfono. `POST /api/app/gafete/entrar` (sin sesión) comprueba gafete vigente + serie del chip + secreto y devuelve un `token_hash` de magiclink (mismo mecanismo que `api/app/puente-web`); la app hace `verifyOtp` y queda con su sesión normal. Para dueño/admin, una segunda llamada ya con sesión emite el pase del segundo paso.

**Tech Stack:** Next.js 16 (rutas `app/api`), Supabase (Postgres + Auth admin), `node --test`, PGlite (`npm run test:db`), Expo (Android SDK 54 / iOS SDK 57), `react-native-nfc-manager`, `expo-secure-store`.

**Spec:** `docs/superpowers/specs/2026-11-27-entrar-con-gafete-design.md`

## Global Constraints

- Sin huella ni Face ID. El login con correo/Google/Apple queda idéntico.
- El gafete **nunca** se bloquea por fallos; **al 4.º fallo seguido en un teléfono**, ese teléfono deja de aceptar gafete hasta que alguien entre con correo en él.
- Tablas nuevas con RLS encendido, **sin políticas**, `revoke all from anon, authenticated` (criterio de db/032). Solo el servidor con llave de servicio.
- El secreto del teléfono **nunca** se guarda en claro en el servidor (solo SHA-256 en hex).
- Roles que pueden usar gafete: `dueno`, `admin`, `operador`. Clientes no.
- Hacia afuera, un fallo de `entrar` siempre dice: **"Este gafete no puede entrar en este teléfono."** Excepciones: el bloqueo del 4.º intento ("Demasiados intentos con el gafete. Entra con tu correo.") y, al vincular, "Este gafete no está ligado a tu cuenta. Pídele a un administrador que lo ligue."
- Repo público: ningún dato real (series, códigos, secretos) en código ni pruebas.
- Las dos apps reciben lo mismo (paridad); sus archivos difieren, cada tarea de app nombra los de las dos.
- `git push` a `main`, `eas build`/`submit` y Apple Developer los autoriza/hace Andrei. Antes de un build: copiar el `.env` de la app (nota "apps al 100%").
- Interfaz según `DESIGN.md` de la raíz.

## Review Focus

1. **Gafete repuesto o empleado dado de baja con teléfono ya vinculado** → `entrar` falla (el par queda atado al `gafete_id` viejo y se exige `estado = 'vigente'`). Prueba en Task 3.
2. **Se cambia `empleados.perfil_id` a otra cuenta** después de vincular → el par viejo ya no entra (se exige `par.perfil_id = empleado.perfil_id`). Prueba en Task 3.
3. **Atacante con la foto del QR manda intentos con un `dispositivo_id` inventado** → no puede bloquear el gafete del dueño ni a otro teléfono; solo recibe el texto genérico. Prueba en Task 3.
4. **Cerrar sesión y volver a entrar con gafete** → el secreto sigue en el teléfono; `salir()` no lo borra. Prueba en Task 5.
5. **Teléfono sin NFC o con NFC apagado** → la opción del gafete no sale / dice "Enciende el NFC"; el login con correo sigue igual. Cubierto en Task 6 (lógica pura `opcionGafete`).

---

### Task 1: Prueba de lectura del chip (spike, se tira)

Decide si el iPhone lee la **serie** del chip. No lleva pruebas automáticas.

**Files:**
- Create (temporal, no se sube): una pantalla de prueba en `App IOS/` y en `App Android/` con `react-native-nfc-manager`.

- [ ] **Step 1:** Instalar `react-native-nfc-manager` en las dos apps (versión compatible con RN 0.81 y 0.86; revisar su README), agregar su plugin en `app.config.js`/`app.json` con `nfcPermission` (texto: "Morcast usa el NFC para leer tu gafete al iniciar sesión.") y, en iOS, los formatos `NDEF` y `TAG`.
- [ ] **Step 2:** Botón que hace `requestTechnology` (iOS: probar `[NfcTech.MifareIOS, NfcTech.Ndef]`; Android: `NfcTech.Ndef`), luego `getTag()` y muestra en pantalla `tag.id` y el URL del primer registro NDEF.
- [ ] **Step 3:** Build de desarrollo (`eas build --profile development`) — lo instala Andrei en su iPhone 16 Pro Max y en un Android con NFC.
- [ ] **Step 4:** Andrei acerca un gafete real. Resultado esperado: **id de 7 bytes (14 hex)** y URL `https://morcast.mx/g/<10 caracteres>` en ambos.
- [ ] **Step 5:** Anotar en este plan, debajo de esta tarea, la llamada exacta que funcionó por plataforma y si el iPhone dio el id. **Si el iPhone no da el id**, la app de iPhone manda `serie: null` (la Task 2 ya lo admite con `exige_serie = false`). Descartar la pantalla de prueba; conservar dependencia y plugin.

---

### Task 2: Base de datos — db/033

**Files:**
- Create: `Web/db/033-entrar-con-gafete.sql`
- Modify: `Web/tests-db/candados.mjs` (casos nuevos al final)

**Interfaces:**
- Produces:
  - `gafetes.chip_serie text` (nullable, `check (chip_serie ~ '^[0-9A-F]{8,20}$')`, mayúsculas sin separadores).
  - Tabla `gafete_telefonos`: `id uuid pk`, `gafete_id uuid not null → gafetes on delete cascade`, `perfil_id uuid not null → perfiles on delete cascade`, `dispositivo_id uuid not null`, `secreto_hash text not null check (secreto_hash ~ '^[0-9a-f]{64}$')`, `aparato text not null default ''` (≤ 60), `exige_serie boolean not null default true`, `fallos integer not null default 0`, `creado timestamptz default now()`, `ultimo_uso timestamptz`, `desvinculado_en timestamptz`, `desvinculado_por uuid → perfiles on delete set null`.
  - Índice único parcial `(gafete_id, dispositivo_id) where desvinculado_en is null`; índice `(dispositivo_id)`.
  - RLS encendido, sin políticas, `revoke all ... from anon, authenticated`.

- [ ] **Step 1: Casos en `candados.mjs`:** `anon` y `authenticated` no pueden `select`/`insert` en `gafete_telefonos` ni leer `gafetes.chip_serie`; `service_role` sí; un segundo par vigente mismo gafete+dispositivo falla por el índice único; uno con `desvinculado_en` puesto sí deja crear otro.
- [ ] **Step 2:** `cd Web && npm run test:db` → FALLA (no existe la tabla).
- [ ] **Step 3:** Escribir `033` (encabezado como el de 032: qué es, por qué sin políticas, "se corre después de 032").
- [ ] **Step 4:** `npm run test:db` → PASA.
- [ ] **Step 5:** Commit `db/033: teléfonos vinculados a gafetes y serie del chip`.

---

### Task 3: Lógica de acceso con gafete (pura) + capa de datos

**Files:**
- Create: `Web/lib/gafete-acceso.mjs` (pura, sin Next ni Supabase)
- Create: `Web/lib/gafete-acceso-servidor.js` (consultas con `supabaseServidor()`)
- Test: `Web/tests/gafete-acceso.test.mjs`

**Interfaces:**
- Consumes: `normalizarCodigo`, `codigoDeEnlace` de `lib/gafetes.mjs`; `esUuid` de `lib/app-auth.mjs`.
- Produces (`gafete-acceso.mjs`):
  - `MAX_FALLOS_TELEFONO = 4`
  - `TEXTOS_GAFETE = { noEntra: "Este gafete no puede entrar en este teléfono.", usaCorreo: "Demasiados intentos con el gafete. Entra con tu correo.", sinCuenta: "Este gafete no está ligado a tu cuenta. Pídele a un administrador que lo ligue.", serieOtra: "Este no es el chip de tu gafete." }`
  - `normalizarSerie(texto) -> string|null` — quita `:`/espacios/guiones, mayúsculas; null si no da 8–20 hex.
  - `async hashSecreto(secreto: string) -> string` — SHA-256 hex con `crypto.subtle`.
  - `validarPeticion({codigo, serie, dispositivoId, secreto}) -> {ok:true, codigo, serie|null, dispositivoId, secreto} | {ok:false}` — código por `normalizarCodigo` (también acepta el enlace completo vía `codigoDeEnlace`), `dispositivoId` uuid, `secreto` 43–128 chars base64url.
  - `decidirEntrada({gafete, empleado, par, serie, hashRecibido}) -> {ok:true} | {ok:false, motivo:"noEntra"|"usaCorreo", contarFallo:boolean}` — orden: par ausente o desvinculado → noEntra sin contar; `par.fallos >= 4` → usaCorreo sin contar; gafete no vigente / empleado no activo / `empleado.perfil_id !== par.perfil_id` / (`par.exige_serie` y `serie !== gafete.chip_serie`) / hash distinto → noEntra **contando**.
  - `decidirVinculo({gafete, empleado, uid, serie}) -> {ok:true, guardarSerie:boolean, exigeSerie:boolean} | {ok:false, motivo:"noEntra"|"sinCuenta"|"serieOtra"}` — gafete vigente y empleado activo, si no noEntra; `empleado.perfil_id !== uid` → sinCuenta; si `gafete.chip_serie` existe y `serie` no es null y difiere → serieOtra; `guardarSerie = !gafete.chip_serie && !!serie`; `exigeSerie = !!serie`.
- Produces (`gafete-acceso-servidor.js`), todas con llave de servicio:
  - `leerParaEntrar(codigo, dispositivoId) -> {gafete, empleado, par}` (par = el vigente de ese gafete+dispositivo o null).
  - `contarFallo(dispositivoId)` — `fallos = fallos + 1` en **todos** los pares vigentes de ese dispositivo.
  - `reiniciarFallos(dispositivoId)`; `anotarUso(parId)` (`ultimo_uso = now()`, `fallos = 0`).
  - `vincular({gafeteId, perfilId, dispositivoId, secretoHash, aparato, exigeSerie, guardarSerie, serie})` — desvincula un par vigente previo del mismo gafete+dispositivo y crea el nuevo; guarda `chip_serie` si `guardarSerie`.
  - `desvincular({parId? , dispositivoId?, perfilId?, por})` — pone `desvinculado_en`/`desvinculado_por`.
  - `telefonosDe(empleadoId) -> [{id, aparato, creado, ultimo_uso, fallos}]` (solo vigentes del gafete vigente).

- [ ] **Step 1: Pruebas en `gafete-acceso.test.mjs`** (con objetos de ejemplo inventados):
  - `decidirEntrada` OK con todo correcto.
  - Gafete `estado:'repuesto'` → `{ok:false, motivo:'noEntra', contarFallo:true}` (Review Focus 1); empleado `estado:'baja'` → igual.
  - `empleado.perfil_id` distinto de `par.perfil_id` → noEntra contando (Review Focus 2).
  - `par = null` → noEntra **sin** contar (Review Focus 3).
  - `par.fallos = 4` → `usaCorreo` aunque todo lo demás sea correcto; `fallos = 3` y todo bien → ok.
  - `exige_serie:true` y serie distinta → noEntra contando; `exige_serie:false` y `serie:null` → ok.
  - `decidirVinculo`: perfil distinto → `sinCuenta`; gafete sin serie + serie leída → `guardarSerie:true`; serie distinta a la guardada → `serieOtra`; `serie:null` → `exigeSerie:false`.
  - `normalizarSerie("04:a1:b2:c3:d4:e5:f6") === "04A1B2C3D4E5F6"`; `normalizarSerie("zz") === null`.
  - `hashSecreto("abc")` = `"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"`.
  - `validarPeticion` acepta `https://morcast.mx/g/<código>` como `codigo`.
- [ ] **Step 2:** `cd Web && node --test tests/gafete-acceso.test.mjs` → FALLA.
- [ ] **Step 3:** Implementar `gafete-acceso.mjs`; luego `gafete-acceso-servidor.js` siguiendo el estilo de `lib/personal-servidor.js`.
- [ ] **Step 4:** `npm test` → todo PASA.
- [ ] **Step 5:** Commit `Gafete: reglas para entrar y vincular`.

---

### Task 4: Rutas `/api/app/gafete/*`

**Files:**
- Create: `Web/app/api/app/gafete/entrar/route.js`, `.../vincular/route.js`, `.../pase/route.js`, `.../telefono/route.js`
- Modify: `Web/lib/bitacora.js` (`TEXTO_ACCION`: `gafete_vincular`, `gafete_entrar`, `gafete_desvincular`)

**Interfaces:**
- Consumes: Task 3; `entrarApp`, `responder` de `lib/app-ruta.js`; `pasarFreno` de `lib/freno.js`; `anotarBitacora` de `lib/app-auth.mjs`; `firmarPase`, `secretoPanel`, `VIGENCIA_PASE_S` de `lib/mfa.mjs`.
- Produces (contratos que usan las apps):
  - `POST /api/app/gafete/entrar` — **sin** Authorization. Body `{codigo, serie, dispositivoId, secreto}` → `200 {ok:true, tokenHash}` · `401 {ok:false, motivo}` (noEntra) · `423 {ok:false, motivo, usaCorreo:true}` · `429` freno. Frenos: `pasarFreno("app-gafete-ip", {maximo:30, minutos:15})` (por IP) y `pasarFreno("app-gafete-codigo:"+codigo, {maximo:10, minutos:15, porIp:false})`. Si `contarFallo` → `contarFallo(dispositivoId)`. Si ok → `anotarUso`, `auth.admin.generateLink({type:"magiclink", email})` del perfil, devuelve `properties.hashed_token`; bitácora `gafete_entrar`.
  - `POST /api/app/gafete/vincular` — Bearer, roles `["dueno","admin","operador"]`, freno `app-gafete-vincular` 10/60. Body `{codigo, serie, dispositivoId, secreto, aparato}` → `200 {ok:true, nombre}` · `400 {ok:false, motivo}`. Bitácora `gafete_vincular`.
  - `POST /api/app/gafete/pase` — Bearer, roles `ROLES_PERSONAL`. Body igual a `entrar`; vuelve a correr `decidirEntrada` y exige `par.perfil_id === usuario.id` → `200 {ok:true, pase, vence}` con `firmarPase({uid, sesion, vence: ahora + VIGENCIA_PASE_S})`; bitácora `entrar_panel` con `detalle:{metodo:"gafete"}`.
  - `POST /api/app/gafete/telefono` — Bearer, roles de gafete. Body `{dispositivoId, accion:"reiniciar"|"desvincular"}`. `reiniciar` → `reiniciarFallos`; `desvincular` → desvincula los pares de ese dispositivo con `perfil_id = usuario.id`. `200 {ok:true}`.

- [ ] **Step 1:** Prueba en `Web/tests/gafete-rutas.test.mjs` de la función pura que arma la respuesta de `entrar` (extraer `respuestaEntrar(decision) -> {status, cuerpo}` a `gafete-acceso.mjs`): noEntra → 401 con `TEXTOS_GAFETE.noEntra`; usaCorreo → 423 con `usaCorreo:true`; ok → 200 (sin tokenHash, lo agrega la ruta).
- [ ] **Step 2:** `node --test tests/gafete-rutas.test.mjs` → FALLA.
- [ ] **Step 3:** Implementar `respuestaEntrar` y las cuatro rutas (encabezado de comentario como `puente-web/route.js`: método, cuerpo, respuestas).
- [ ] **Step 4:** `npm test` y `npm run build` → PASAN.
- [ ] **Step 5:** Commit `API de la app: entrar, vincular, pase y teléfono con gafete`.

---

### Task 5: Panel — ligar cuenta y desvincular teléfonos

**Files:**
- Modify: `Web/app/(admin)/admin/personal/[id]/` (ficha), `Web/app/(admin)/admin/personal/acciones.js`, `Web/app/(admin)/admin/personal/FormEmpleado.js`
- Modify: `Web/lib/personal-servidor.js` (`expediente` trae `perfil_id`; nueva `cuentasDelPersonal()`)
- Test: `Web/tests/personal.test.mjs`

**Interfaces:**
- Consumes: `telefonosDe`, `desvincular` (Task 3).
- Produces: acciones de servidor (todas tras `exigirSeccion("personal")`, con bitácora): `ligarCuenta({empleadoId, perfilId|null})` — rechaza un `perfilId` que no sea `dueno/admin/operador` o que ya esté ligado a otro empleado activo; `desvincularTelefono({parId})`.

- [ ] **Step 1:** Prueba de la regla pura `puedeLigarse({perfil, ligadoA, empleadoId})` (agregar a `lib/personal.mjs`): cliente → false; perfil ligado a otro empleado activo → false; libre → true; el mismo empleado → true.
- [ ] **Step 2:** `node --test tests/personal.test.mjs` → FALLA.
- [ ] **Step 3:** Implementar `puedeLigarse`, `cuentasDelPersonal()`, las dos acciones; en la ficha: campo **"Cuenta en la app"** (lista de cuentas del personal o "Ninguna") y sección **"Teléfonos vinculados"** (aparato, fecha, último uso; si `fallos >= 4`, etiqueta "Pide correo") con botón **Desvincular** y confirmación. Sin gafete vigente o sin teléfonos: "Ningún teléfono vinculado".
- [ ] **Step 4:** `npm test`, `npm run build`; revisar la ficha con `/browse` en `npm run dev` (desde `Web/`).
- [ ] **Step 5:** Commit `Personal: ligar cuenta de la app y desvincular teléfonos`.

---

### Task 6: Apps — lógica del gafete (pura) + llamadas

Mismo contenido en las dos apps; nombres por app abajo.

**Files:**
- Create: `App Android/src/gafete-login.mjs` y `App IOS/src/gafete-login.mjs` (puros, idénticos)
- Create: `App Android/src/gafete.js` y `App IOS/src/gafete.js` (NFC + SecureStore + red)
- Modify: `App Android/src/sesion.js`, `App IOS/src/sesion.js` (`entrarConGafete`; `salir()` no toca el secreto)
- Modify: `App Android/src/segundo-paso.js` y en iOS `App IOS/src/segundo-paso.mjs`/`pase-admin.js` (exportar `guardarPase({pase, vence})`, extraído de lo que ya hace `verificarCodigo`)
- Test: `App Android/tests/gafete-login.test.mjs`, `App IOS/tests/gafete-login.test.mjs`; agregar `TEXTOS_GAFETE` a `tests/espejos-web.test.mjs` de cada app.

**Interfaces:**
- Consumes: contratos de Task 4; resultado de Task 1 (llamada NFC por plataforma).
- Produces:
  - `gafete-login.mjs`: `TEXTOS_GAFETE` (copia exacta de la web), `datosDelTag(tag) -> {codigo, serie}|null` (código del URL NDEF con la misma regla que `codigoDeEnlace`; serie de `tag.id` normalizada; `serie:null` si no hay id), `opcionGafete({hayNfc, nfcEncendido, bloqueadoLocal}) -> "oculta"|"enciende"|"usaCorreo"|"lista"`, `nuevoSecreto(bytes: Uint8Array) -> string` (base64url, 32 bytes).
  - `gafete.js`: `nfcDisponible() -> {hayNfc, nfcEncendido}`, `leerGafete() -> {codigo, serie}` (lanza "cancelado" si la persona cierra la hoja de iOS), `identidadTelefono() -> {dispositivoId, secreto}` (crea y guarda la primera vez en `almacenSecreto`/`llaveroApp`, llave `morcast_gafete_telefono`; **no se borra al salir**), `vincularGafete() -> {ok, nombre}|{ok:false, mensaje}`, `reiniciarIntentos()`, `desvincularEsteTelefono()`.
  - `sesion.js`: `entrarConGafete() -> {ok:true, modo, perfil} | {ok:false, mensaje, usaCorreo?:true}` — lee chip → `POST gafete/entrar` → `supabase.auth.verifyOtp({token_hash, type:"magiclink"})` → si rol `dueno/admin`, `POST gafete/pase` y `guardarPase` → `destinoDeUsuario(user)`. Con `usaCorreo`, guarda la marca local `bloqueadoLocal`.
  - Tras **cualquier** login con correo/Google/Apple con éxito: llamar `reiniciarIntentos()` y borrar `bloqueadoLocal`.

- [ ] **Step 1: Pruebas** `gafete-login.test.mjs`: `datosDelTag({id:"04a1b2c3d4e5f6", ndefMessage:[registro URL de https://morcast.mx/g/ABCDEFGHJK]})` → `{codigo:"ABCDEFGHJK", serie:"04A1B2C3D4E5F6"}`; URL de otro dominio → null; sin id → `serie:null`; `opcionGafete`: sin NFC → "oculta", apagado → "enciende", bloqueado → "usaCorreo", todo bien → "lista" (Review Focus 5); `nuevoSecreto(new Uint8Array(32))` da 43 caracteres. Prueba de que `salir()` no borra la llave `morcast_gafete_telefono` (con almacén de mentira, Review Focus 4).
- [ ] **Step 2:** `npm test` en cada app → FALLA.
- [ ] **Step 3:** Implementar en Android y copiar a iOS ajustando imports a sus archivos (`almacenSecreto` en Android, `llaveroApp` en iOS; el pase según cada app).
- [ ] **Step 4:** `npm test` en las dos apps → PASA (incluye espejos-web).
- [ ] **Step 5:** Commit `Apps: entrar con gafete (lógica, NFC y sesión)`.

---

### Task 7: Apps — pantallas

**Files:**
- Modify: `App Android/src/pantallas/admin/LoginAdmin.js`, `App Android/src/pantallas/chofer/LoginChofer.js`, y los mismos en `App IOS/src/pantallas/...`
- Modify: Mi cuenta / Más del admin y chofer en cada app (buscar dónde está "Cerrar sesión": `MasAdmin.js` y su equivalente del chofer)
- Create: `App Android/src/BotonGafete.js`, `App IOS/src/BotonGafete.js`

**Interfaces:**
- Consumes: Task 6.

- [ ] **Step 1:** `BotonGafete`: bloque arriba del formulario con el texto "Inicia sesión acercando tu gafete", según `opcionGafete`: "lista" → botón **Acercar gafete** (iOS) / texto "Acerca tu gafete a la parte de atrás del teléfono" y lectura automática mientras la pantalla está enfocada (Android); "enciende" → "Enciende el NFC para entrar con tu gafete"; "usaCorreo" → `TEXTOS_GAFETE.usaCorreo`; "oculta" → nada. Debajo, separador "o entra con tu correo" y el formulario actual sin cambios. Al éxito llama `onLogin` igual que el login con correo.
- [ ] **Step 2:** Después de un login con correo exitoso en esas pantallas, si este teléfono no tiene ese gafete vinculado: aviso **"¿Vincular tu gafete a este teléfono?"** (Vincular / Ahora no). "Ahora no" no vuelve a preguntar en este teléfono para esa cuenta. También en Mi cuenta: **Vincular mi gafete** y **Desvincular este teléfono**.
- [ ] **Step 3:** `npm test` en las dos apps; revisar visualmente en el build de desarrollo (Andrei): gafete vigente entra; 4 fallos seguidos con otro chip → mensaje de correo; tras entrar con correo vuelve a aparecer el botón; desvincular desde el panel → el gafete ya no entra.
- [ ] **Step 4:** Commit `Apps: botón de gafete en el inicio de sesión y vincular en Mi cuenta`.

---

### Task 8: Publicación (la hacen Andrei/Luis)

- [ ] **Step 1:** Andrei: correr `db/033` en Supabase.
- [ ] **Step 2:** Andrei: `git push` de la rama a `main` (web primero; las apps viejas no llaman a estas rutas).
- [ ] **Step 3:** Andrei, en el panel: ligar la cuenta de cada uno de los 4 empleados.
- [ ] **Step 4:** Subir versión de las dos apps (`app.config`), copiar `.env`, `eas build --profile production` y `eas submit`; Apple: confirmar la capacidad *NFC Tag Reading* en el identificador. Nota para revisión de Apple: la cuenta de muestra entra con correo.
- [ ] **Step 5:** Actualizar `docs/manual-empresa.md` y `docs/manual-tecnico.md` (cómo vincular, desvincular, qué hacer si pide correo).
