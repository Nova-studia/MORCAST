import { EMPRESA } from "@/lib/datos";

export default function sitemap() {
  const base = EMPRESA.sitio;
  const ahora = new Date();

  return [
    { url: base, lastModified: ahora, changeFrequency: "monthly", priority: 1 },
    {
      url: `${base}/servicios`,
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${base}/equipo`,
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/contenedores`,
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/scrap`,
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${base}/permisos`,
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/nosotros`,
      lastModified: ahora,
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: `${base}/contacto`,
      lastModified: ahora,
      changeFrequency: "yearly",
      priority: 0.9,
    },
    {
      url: `${base}/aviso-de-privacidad`,
      lastModified: ahora,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
