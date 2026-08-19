# Ficha de Google Play Store — App Morcast

App: **Morcast** · Paquete: `mx.morcast.app` · Cuenta: Morcast del Norte (organización)
Categoría sugerida: **Negocios** (Business)
Fecha: 24 de julio de 2026

---

## 1. Nombre de la app (máx. 30 caracteres)

Elige una (todas caben en 30):

1. `Morcast` *(el más limpio; coincide con la app)*
2. `Morcast del Norte` *(refuerza la marca — 17 car.)*
3. `Morcast — Portal de clientes` *(descriptivo, ayuda en búsquedas — 28 car.)*

**Recomendada:** opción 2 · `Morcast del Norte`

---

## 2. Descripción corta (máx. 80 caracteres)

> Portal de clientes de Morcast: recolección y manejo de residuos industriales.

*(76 caracteres. Aparece bajo el ícono en los resultados.)*

Alternativa:
> Gestiona tus recolecciones, saldo y comprobantes de residuos con Morcast.

---

## 3. Descripción larga (máx. 4000 caracteres)

```
Morcast del Norte — Gestión de residuos, en tu teléfono

La aplicación de Morcast del Norte es el portal móvil para los clientes,
el personal y los operadores de nuestro servicio de recolección y manejo
integral de residuos en Matamoros y la región.

Desde la app puedes dar seguimiento a cada servicio, revisar tu cuenta y
mantener tu operación en orden, sin llamadas ni papeleo.

PARA CLIENTES
• Consulta el historial completo de tus recolecciones: tipo de residuo,
  volumen, folios y manifiestos.
• Revisa tu saldo, movimientos y facturación en tiempo real.
• Sube el comprobante de tu pago desde la cámara o la galería y dale
  seguimiento a su verificación.
• Consulta tus reportes de volumen y composición de residuos.
• Solicita nuevos servicios y contáctanos directo por WhatsApp.

PARA EL EQUIPO OPERATIVO
• Escanea el código QR del contenedor para registrar la recolección.
• Toma la evidencia fotográfica antes y después del servicio.
• Consulta tu ruta y los servicios asignados del día.

PARA ADMINISTRACIÓN
• Revisa solicitudes, clientes, saldos y servicios en un solo lugar.
• Verifica comprobantes de pago y activa cuentas de cliente.
• Consulta reportes de la operación.

POR QUÉ MORCAST
Morcast del Norte ofrece recolección y manejo de Residuos Sólidos Urbanos,
Manejo Especial, Aguas Oleosas, Residuos Peligrosos y Reciclaje, con
trazabilidad y cumplimiento normativo. Esta app acerca esa trazabilidad a
la palma de tu mano.

PRIVACIDAD
No mostramos publicidad, no rastreamos tu actividad y no vendemos tus
datos. La app solo usa la cámara y tus fotos cuando tú lo decides, para
escanear contenedores y adjuntar comprobantes.

Consulta nuestro Aviso de Privacidad en https://morcast.mx/privacidad

Morcast del Norte · Matamoros, Tamaulipas · contacto@morcast.mx
```

*(≈1,750 caracteres — bien dentro del límite.)*

---

## 4. Datos de contacto de la ficha (obligatorios)

| Campo | Valor |
|---|---|
| Correo de soporte | contacto@morcast.mx |
| Sitio web | https://morcast.mx |
| Teléfono (opcional) | *(el de la empresa, si quieren)* |
| Política de privacidad (URL) | **https://morcast.mx/privacidad** ← hay que publicarla primero |

---

## 5. Formulario "Seguridad de los datos" (Data Safety) — respuestas

> Esta sección es OBLIGATORIA y debe coincidir con lo que hace la app. Estas
> respuestas asumen la versión de producción (con cuentas reales / Supabase).

**¿La app recopila o comparte datos de usuario?** → **Sí, recopila.**
**¿Los datos están cifrados en tránsito?** → **Sí.**
**¿El usuario puede pedir que se eliminen sus datos?** → **Sí** (por correo a contacto@morcast.mx).

**Tipos de datos recopilados:**

| Categoría | Tipo de dato | ¿Recopilado? | ¿Compartido? | Propósito |
|---|---|---|---|---|
| Info personal | Nombre | Sí | No | Funcionalidad de la app, gestión de cuenta |
| Info personal | Correo electrónico | Sí | No | Funcionalidad de la app, gestión de cuenta |
| Info personal | Teléfono | Sí | No | Funcionalidad de la app |
| Info personal | Otra (RFC/razón social) | Sí | No | Funcionalidad de la app |
| Info financiera | Info de pagos (comprobante) | Sí | No | Funcionalidad de la app |
| Fotos y videos | Fotos | Sí | No | Funcionalidad de la app (comprobantes, evidencia) |
| Actividad en la app | Historial de servicios | Sí | No | Funcionalidad de la app |

**Marca "NO" en:** Ubicación, Contactos, Historial de navegación, Info de salud,
Mensajes, Identificadores del dispositivo, y en TODO lo relacionado con
**publicidad, marketing o analítica de terceros**.

**Prácticas de seguridad:** datos cifrados en tránsito · el usuario puede
solicitar la eliminación de sus datos.

---

## 6. Recursos gráficos que Google exige

| Recurso | Especificación | Estado |
|---|---|---|
| Ícono de la app | 512 × 512 px, PNG 32-bit | ✅ ya existe (`assets/icon.png`) — verificar tamaño |
| Gráfico destacado (Feature graphic) | 1024 × 500 px, JPG/PNG | ⬜ por crear |
| Capturas de teléfono | mín. 2, máx. 8 · 16:9 o 9:16 · lado mín. 320px | ⬜ por capturar (login, inicio, historial, saldo) |
| (Opcional) Capturas de tablet | 7" y 10" | ⬜ opcional |

*Yo te puedo generar el feature graphic y ayudarte a sacar las capturas cuando corramos la app.*

---

## 7. Clasificación de contenido

- Cuestionario IARC dentro de Play Console → categoría **Utilidad / Productividad / Negocios**, sin violencia, sin contenido sexual, sin apuestas.
- Resultado esperado: **Para todos / PEGI 3**.

---

## 8. ⚠️ Puntos importantes antes de enviar

1. **Publicar la política de privacidad primero.** Sube `politica-privacidad.html`
   a `https://morcast.mx/privacidad` (te dejo el archivo listo). La URL debe abrir
   públicamente antes de mandar la ficha, o Google la rechaza.

2. **Cuenta de prueba para la revisión.** La app tiene login. Google (y sobre todo
   Apple después) pueden pedir un **usuario/contraseña demo** para revisarla. Hay que
   dejar un acceso funcional y ponerlo en las notas para el revisor. Recuerda que en la
   entrega "solo-visual" quitamos las credenciales de los logins — para la tienda hay
   que reactivar un acceso demo.

3. **App B2B en tienda pública.** Cualquiera puede descargarla aunque sea un portal de
   clientes. Si no quieren eso, Play Console permite **"publicación interna" o por lista
   cerrada de correos** — decidir antes de publicar.

4. La categoría "Negocios" y el enfoque de residuos peligrosos no dan problema en Google;
   en Apple a veces piden comprobar que representas a la empresa (por eso conviene la
   cuenta de organización).
```
