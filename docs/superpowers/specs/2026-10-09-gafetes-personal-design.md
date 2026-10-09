# Personal y gafetes con QR + NFC — diseño

> 9-oct-2026. Lo pidió Luis, sobre la propuesta de gafete v2 (sep-2026, `Morcast Gafetes\`).
> Lo aprobó por partes en esta sesión: esquema de 3 niveles, NFC sí, imprenta imprime y Morcast graba los chips,
> página con sello arriba (opción A), reverso sin datos sensibles (opción A), y punto 4: altas, bajas y
> reposiciones desde el panel, solo con permiso que asigna el dueño.

## Para qué

1. **Verificar** que una persona es empleada vigente de Morcast. Lo hacen clientes, guardias de planta,
   la oficina o una autoridad, escaneando el QR o acercando el teléfono al chip.
2. **Datos de emergencia** a la mano en un accidente, protegidos con un PIN.
3. **Directorio y organigrama del personal** en el panel. Así se dan altas, bajas y reposiciones
   sin depender de nadie.
4. **Dejar listo el checador futuro:** el mismo código del gafete identifica al empleado.

**Éxito:**
- La empresa devuelve los dos Excel, Morcast los carga y saca el PDF para la imprenta.
- Morcast graba los chips.
- Al escanear un gafete sale VIGENTE con la hora en vivo.
- Si se da de baja a alguien, su gafete dice NO VÁLIDO al instante.

## Fuera de alcance (preparado, no construido)

- el checador;
- los avisos de licencias por vencer;
- la credencial en Apple o Google Wallet;
- las pantallas en la app (se harán con la paridad de las apps).

## Los tres niveles (`morcast.mx/g/<código>`)

| Nivel | Qué se ve | Quién | Cómo |
|---|---|---|---|
| 1 · Verificación | Sello **✓ VIGENTE** (verde, de lado a lado) o **✕ NO VÁLIDO** (rojo); foto, nombre, puesto, no. de empleado, área; hora en vivo, segundo a segundo | cualquiera | QR o chip, sin PIN |
| 2 · Emergencia | Tipo de sangre, alergias, contacto y teléfono de emergencia | guardia, paramédico, autoridad | **PIN de 6 dígitos impreso atrás**; solo si `permiso_emergencia = true` |
| 3 · Expediente | Todo (datos, historial de gafetes, organigrama) | oficina | sesión en el panel con la sección **Personal**; nunca desde `/g` |

- **NO VÁLIDO:** cuando el empleado está de baja o el gafete fue repuesto o anulado. No muestra la ficha ni
  el nivel 2.
- **La hora en vivo** es la prueba contra capturas de pantalla: la pie de página lo dice ("Si la hora no
  avanza, no es válida").
- **La página `/g/[codigo]`:** dinámica (nunca prerenderizada), `noindex`, sin caché, con el botón "Llamar a
  Morcast".
- **Intentos de PIN:**
  - con freno: 5 intentos por gafete cada 15 minutos y 20 por IP cada hora;
  - cada consulta acertada del nivel 2 queda en la bitácora (gafete y momento, sin datos);
  - el error siempre dice lo mismo: "PIN incorrecto", nunca si el gafete existe.

## El gafete

- **Frente:** como el v2 de septiembre:
  - logo;
  - franjas `#044D57` y `#F77B39`;
  - foto con marco;
  - nombre;
  - puesto en etiqueta naranja (texto negro);
  - número de empleado.
- **Vuelta:** opción A, sin datos sensibles:
  - el QR al enlace;
  - el enlace escrito;
  - "o acerca tu teléfono aquí";
  - la caja **PIN DE EMERGENCIA** con el PIN;
  - "Escanea e ingresa el PIN…", y "Si lo encuentras, llama a Morcast";
  - la emisión (mes/año).
- **Chip NFC** dentro del PVC (NTAG213/215), con el mismo enlace, grabado por Morcast y sellado.
- **Código:**
  - 10 caracteres aleatorios, sin letras que se confunden (sin 0/O/1/l);
  - **uno por gafete impreso**, no por persona;
  - reponer da código y PIN nuevos.
- **PIN:** 6 dígitos aleatorios por gafete. Se guarda **cifrado de forma reversible** (el panel lo enseña para
  reimprimir) con una llave del servidor, y se compara en el servidor.

## Datos (migración 032)

- **`empleados`:**
  - `id`, `numero` (único, texto), `nombre`, `apellido_paterno`, `apellido_materno`, `puesto`, `area`;
  - `tipo` ('administrativo' | 'general');
  - `reporta_a` (→ empleados, `set null`);
  - `foto_ruta` (cubeta privada `personal`);
  - `estado` ('activo' | 'baja'), `baja_fecha`, `baja_motivo`;
  - emergencia: `tipo_sangre`, `alergias`, `contacto_emergencia`, `telefono_emergencia`, `permiso_emergencia bool`;
  - `perfil_id` (→ perfiles, opcional: el chofer que además tiene cuenta);
  - `creado`, `creado_por`.
- **`gafetes`:**
  - `id`, `empleado_id`, `codigo` (único), `pin_cifrado`;
  - `estado` ('vigente' | 'repuesto' | 'anulado');
  - `emitido`, `emitido_por`, `chip_grabado_en`, `anulado_en`, `anulado_motivo`.
  - Único: un solo gafete `vigente` por empleado.
- **RLS:**
  - **nadie** lee estas tablas sin la sección `personal` (`puede_seccion('personal')` para leer y escribir);
  - la página pública lee con la llave de servicio, solo los campos de su nivel.
  - La sección `personal` se agrega a `lib/permisos.mjs` y a la 029 (`roles_permisos_validos`). **No** se siembra
    en "Administrador completo": la da el dueño.
- **Cubeta `personal`:** privada. Las fotos se sirven por una ruta del servidor que revisa el nivel (la foto
  del nivel 1 es pública solo a través de `/g/<código>` vigente).
- **Bitácora:** en las altas, bajas, reposiciones, ediciones, consultas de emergencia y chips grabados.

## Panel: sección "Personal" (`/admin/personal`)

- **Lista:**
  - buscador, filtro por tipo y estado, y "chip pendiente de grabar";
  - por empleado: foto, nombre, puesto, área, número, estado y gafete (vigente o sin imprimir).
- **Nuevo empleado:** formulario con foto (desde el teléfono o un archivo). Al guardar se crea su gafete.
- **Ficha:**
  - editar datos y foto;
  - emergencia (con el aviso de permiso firmado);
  - gafete: código, PIN, PDF, **Grabar chip**, **Reponer**;
  - **Dar de baja** y **Reactivar** (reactivar emite un gafete nuevo).
- **Organigrama:** el árbol por "Reporta a" de los administrativos.
- **Cargar Excel:**
  - se suben los dos archivos de la empresa;
  - **vista previa** de qué se crea, qué falta (foto, puesto) y qué no cuadra ("Reporta a" inexistente,
    duplicados);
  - luego se confirma;
  - las fotos se leen de las imágenes "sobre las celdas" del Excel o de archivos sueltos con el nombre indicado.
- **PDF para imprenta:**
  - de uno, de los seleccionados o de los "sin imprimir";
  - CR80 (54 × 85.6 mm) con 2 mm de sangría y marcas de corte, frente y vuelta;
  - **hoja de control** con nombre, número, enlace y casilla de "chip grabado".
- **Grabar chip:**
  - Web NFC (Chrome Android): `NDEFReader.write(url)` y luego `makeReadOnly()`, y se marca `chip_grabado_en`;
  - en otros navegadores, el botón explica que hace falta un Android con Chrome, o la app NFC Tools con el
    enlace copiado.
- **Permisos:**
  - todo esto, incluido ver PINs y la emergencia, pide la sección `personal`;
  - el dueño la asigna en Roles como las demás.

## Checador (futuro, ya preparado)

- El checador leerá el **código del gafete vigente** y obtendrá al empleado.
- Un gafete repuesto o anulado no checa.
- Riesgo conocido: un QR se copia con una foto. Al checar habrá que tomar foto o rostro (base: el checador facial de
  RAMGUE).

## Pruebas

- **`test:db` (sección 26):**
  - sin la sección `personal` no se lee ni escribe;
  - un solo gafete vigente por empleado;
  - un cliente o un chofer no ven nada.
- **`npm test`:**
  - códigos (alfabeto y longitud) y PIN;
  - niveles de la página según el estado (vigente, baja, repuesto);
  - freno de PIN;
  - armado del PDF (medidas);
  - lectura del Excel (columnas, vacíos, "Reporta a", duplicados);
  - validación del alta.
- **Visual:** la página pública en el teléfono (vigente, no válido, PIN) y el PDF impreso a escala, verificando
  que el QR se lee.
- **Revisión independiente** al final.

## Riesgos y decisiones

- **Repo público:** ninguna foto ni dato de empleado entra al repo; los Excel se suben solo al panel.
- **Datos sensibles** (sangre y contacto): solo con permiso firmado. El nivel 2 queda registrado.
- **Llave del PIN:** nueva variable `PERSONAL_PIN_LLAVE` en Vercel (sin ella, no se emiten gafetes).
- **Apps:** fuera de alcance. El enlace funciona en cualquier teléfono sin instalar nada.
