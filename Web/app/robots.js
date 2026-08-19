import { EMPRESA } from "@/lib/datos";

export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${EMPRESA.sitio}/sitemap.xml`,
  };
}
