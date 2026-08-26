// Cruce de TODO nombre importado de Phosphor contra lo que el paquete exporta.
// Es el chequeo que faltó y que habria cazado MapPinSlash antes de compilar.
import fs from "fs"; import path from "path";
const m = await import("@phosphor-icons/react/dist/ssr");
const existe = new Set(Object.keys(m));
const malos = [];
const rec = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const f = path.join(d, e.name);
  if (e.isDirectory()) { if (!["node_modules", ".next"].includes(e.name)) rec(f); continue; }
  if (!e.name.endsWith(".js")) continue;
  const t = fs.readFileSync(f, "utf8");
  const im = t.match(/import \{([^}]*)\} from "@phosphor-icons\/react\/dist\/ssr";/s);
  if (!im) continue;
  for (const n of im[1].split(",").map((x) => x.trim()).filter(Boolean))
    if (!existe.has(n)) malos.push(`${f}: ${n}`);
} };
["app", "components", "lib"].forEach(rec);
console.log(malos.length ? "NO EXISTEN:\n  " + malos.join("\n  ") : "todos los iconos importados existen en Phosphor");
