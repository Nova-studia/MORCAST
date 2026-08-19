# Morcast del Norte — Sitio web

Sitio corporativo de **Morcast del Norte, S.A. de C.V.** (manejo de residuos, Matamoros, Tamaulipas).

## Stack

| Pieza | Versión | Nota |
|---|---|---|
| Next.js | 16.2.10 (App Router) | Turbopack va **por defecto**; no lleva flag `--turbopack` |
| React | 19.2 | |
| Bootstrap | 5.3 | Se importa en `app/layout.js` |
| Reactstrap | 9.2 | Solo en componentes con `"use client"` |
| Fuentes | Montserrat + Inter | Vía `next/font`, self-hosted (0 requests a Google) |

> **Sobre Vite:** Next.js trae su propio compilador (Turbopack) y no es compatible con Vite —
> son herramientas que cumplen la misma función. La velocidad de arranque que da Vite ya
> viene incluida en Next 16.

## Arranque

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de producción
npm start        # servir el build
```

## Variables de entorno

La configuración de servicios (correo, almacenamiento del formulario) va en un archivo
local `.env.local` que **no se sube al repositorio**. El sitio funciona sin configurar nada:
si las variables están vacías, el formulario sigue aceptando solicitudes y no se pierde
ningún prospecto. Las claves reales se manejan fuera de git, en el servidor.

## Estructura

```
app/
  layout.js              # fuentes, Bootstrap, SEO global, navbar/footer
  page.js                # inicio
  actions.js             # "use server" — envío del formulario (valida + anti-spam)
  servicios/             nosotros/            equipamiento/
  contacto/              aviso-de-privacidad/
  sitemap.js             robots.js
components/
  NavBar.js              # "use client" (Reactstrap)
  FormularioCotizacion.js# "use client" (useActionState)
  Footer.js  Secciones.js  Iconos.js  BotonWhatsApp.js
lib/
  datos.js               # ← TODO EL CONTENIDO DEL SITIO VIVE AQUÍ
public/img/              # logo + fotos extraídas del folleto oficial
```

### Para editar textos

Casi todo (servicios, teléfonos, correos, clientes, equipamiento, permisos) está en
**`lib/datos.js`**. No hace falta tocar componentes.

## Marca

Colores muestreados del folleto oficial (`SERVICIO DE RECOLECCIÓN...v3.pdf`):

| Color | Hex | Uso |
|---|---|---|
| Verde | `#4EB34A` | Acentos, chevrones, hoja del logo |
| Verde banner | `#2DA529` | Fondos de sección |
| Teal | `#144C4F` | "mor", "DEL NORTE", ícono del camión |
| Naranja | `#DB652D` | "cast", subtítulos de acento |

El **chevron diagonal** es el elemento firma de la marca (`.mc-chevron`, `.mc-hero-chevron`),
igual que los cortes diagonales en las fotos (`.mc-foto-diag`).

## Pendientes antes de publicar

- [ ] **Fotos originales.** Las de `public/img/` se extrajeron del PDF y están limitadas en
      resolución. Pedir los originales al cliente.
- [ ] **La foto de la pipa lleva rotulado "Julian & Son"** — es de otra empresa. Reemplazar
      por una unidad propia de Morcast.
- [ ] **Logos de clientes.** `lib/datos.js` → `CLIENTES` tiene `logo: null` y muestra el
      nombre en texto. Para poner los logos hay que tener autorización **por escrito** de
      cada marca (CEMEX, McDonald's, Coppel…). Colocar archivos en `public/img/clientes/`.
- [ ] **Redacción de permisos.** El folleto dice "PERMISO SEMARNAT VIGENTE" a secas, pero el
      cliente aclaró que los residuos peligrosos van vía tercero autorizado. El sitio usa la
      redacción precisa del cliente. Confirmar con él antes de publicar.
- [ ] **Aviso de privacidad**: falta domicilio fiscal y revisión de un abogado.
- [ ] Domicilio físico, horario exacto y dominio final (`EMPRESA.sitio` en `lib/datos.js`).
- [ ] Verificar el número de WhatsApp (`EMPRESA.whatsapp`).

## Notas de Next.js 16

- `next lint` fue **eliminado**; `next build` ya no corre ESLint.
- `params`/`searchParams` son Promises: hay que `await` si se agregan rutas dinámicas.
- `images.qualities` por defecto es `[75]`; otros valores se fuerzan a 75.
- Caché de imágenes: 4 horas por defecto. Si cambias una foto en desarrollo y no se
  actualiza, borra `.next/cache/images` y recarga con caché desactivada.
