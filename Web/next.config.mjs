/** @type {import('next').NextConfig} */

const enDesarrollo = process.env.NODE_ENV === "development";

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
