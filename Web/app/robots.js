import { EMPRESA } from "@/lib/datos";

export default function robots() {
  return {
    // `/g/` son las páginas de los gafetes del personal: no son para buscadores.
    rules: { userAgent: "*", allow: "/", disallow: "/g/" },
    sitemap: `${EMPRESA.sitio}/sitemap.xml`,
  };
}
