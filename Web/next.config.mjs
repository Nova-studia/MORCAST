/** @type {import('next').NextConfig} */

// Ruta relativa, no el alias "@/...": este archivo lo carga Node directo (no
// pasa por el empaquetador de Next), y `lib/empleo.mjs` está escrito a
// propósito sin importar React ni Supabase para poder importarse así, igual
// que ya hacen las pruebas de `npm test`.
import { MAX_CV_BYTES } from "./lib/empleo.mjs";

const enDesarrollo = process.env.NODE_ENV === "development";

/**
 * Next 16 corta el cuerpo de una acción de servidor en 1 MB por omisión —
 * para no gastar recursos del servidor de más ni abrir la puerta a un DDoS
 * con cuerpos gigantes—, pero `enviarSolicitudEmpleo()` (acciones-empleo.js)
 * recibe el currículum dentro de ese mismo cuerpo, y tanto `lib/empleo.mjs`
 * como la etiqueta del formulario prometen hasta `MAX_CV_BYTES` (5 MB). Sin
 * subir este límite, un currículum escaneado de más de 1 MB —la mayoría—
 * rebotaba con la acción entera rechazada, no con el mensaje de "máximo
 * 5 MB" que sí existe para ese caso.
 *
 * Atado a `MAX_CV_BYTES` (no a un número suelto) para que suban juntos si un
 * día cambia el tope del currículum. El +1 MB de margen es para lo que
 * `multipart/form-data` añade encima del archivo: los boundaries, las
 * cabeceras de cada parte y los demás campos del formulario (nombre,
 * teléfono, correo, puesto, hasta 2000 caracteres de experiencia) — de sobra
 * para eso, que no llega ni a unos KB.
 */
const LIMITE_ACCIONES_SERVIDOR = MAX_CV_BYTES + 1024 * 1024;

/**
 * Política de Contenido (CSP). Se manda en modo SOLO-REPORTE a propósito.
 *
 * En modo reporte el navegador NO bloquea nada: solo avisa en la consola lo
 * que habría bloqueado. Así medimos qué se rompería —sobre todo la generación
 * de PDF del portal y los mapas— antes de encender el bloqueo de verdad.
 * Cuando esté limpia, se cambia la llave a "Content-Security-Policy".
 *
 * Nota honesta: `'unsafe-inline'` en script-src debilita bastante la CSP. Next
 * inserta scripts en línea para hidratar la página y sin un nonce no hay forma
 * de evitarlo. El siguiente paso es generar ese nonce en proxy.js.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  // Los mapas bajan las teselas de OpenStreetMap; blob: y data: los usa el PDF.
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  // accounts.google.com tambien va en style-src: GIS mete su propia hoja de
  // estilo remota para el boton. OJO con la trampa: `unsafe-inline` NO la
  // cubre — eso habilita <style> y atributos style=, no un <link> a otro
  // dominio. Sin esto, el dia que la CSP pase a modo real el boton de Google
  // se dibuja sin estilos.
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  // accounts.google.com: el guion de Google Identity Services, que dibuja el
  // boton de "Continuar con Google" y devuelve el token en esta misma pagina.
  `script-src 'self' 'unsafe-inline' https://accounts.google.com${enDesarrollo ? " 'unsafe-eval'" : ""}`,
  "font-src 'self' data:",
  // Supabase (sesión y consultas) y las teselas.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.tile.openstreetmap.org https://accounts.google.com",
  // GIS dibuja su boton y su selector de cuenta dentro de un iframe suyo.
  "frame-src 'self' https://accounts.google.com",
  // `upgrade-insecure-requests` NO va aquí: el navegador lo ignora en una
  // política de solo-reporte y escupe un error en la consola de CADA página.
  // El sitio ya obliga HTTPS por HSTS y por la redirección 301 de nginx.
  // Cuando la CSP pase a modo real, esta línea se vuelve a poner.
].join("; ");

const cabeceras = [
  // Obliga a HTTPS durante un año. SIN `preload` a propósito: entrar a la lista
  // de precarga de los navegadores es casi imposible de deshacer.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Que nadie meta morcast.mx dentro de un iframe suyo (clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Impide que el navegador "adivine" el tipo de un archivo servido.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No filtrar la URL completa al salir del sitio.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nada de cámara, micrófono ni ubicación desde la web. La cámara del chofer
  // vive en las apps nativas, no aquí.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: LIMITE_ACCIONES_SERVIDOR,
    },
  },

  images: {
    // La foto del hero del inicio se pide con `quality={92}`. Next 16 solo
    // sirve las calidades que estan aqui: sin el 92, la bajaba a 75 sin decir
    // nada (solo un aviso en la consola) y la portada salia mas pastosa de lo
    // que se pidio.
    qualities: [75, 92],
  },

  async headers() {
    return [{ source: "/:path*", headers: cabeceras }];
  },

  async redirects() {
    // La página se renombró de /equipamiento a /equipo (jul 2026).
    return [
      { source: "/equipamiento", destination: "/equipo", permanent: true },
    ];
  },
};

export default nextConfig;
