import {
  claveDeNombre,
  nombreCompleto,
  validarEmpleado,
  normalizarSangre,
  normalizarTelefono,
  normalizarNumero,
  esSi,
} from "./personal.mjs";

/**
 * LOS EXCEL DEL PERSONAL → una lista de personas por dar de alta.
 *
 * La empresa llena dos plantillas («Organigrama administrativo» y «Personal
 * general», en `Morcast Gafetes\Para la empresa\`) y las devuelve. Aquí se
 * interpreta lo que trae cada hoja (ya leída con lib/xlsx-lector.mjs) y se
 * arma la VISTA PREVIA: qué se crea, qué le falta a cada quien y qué no
 * cuadra. Nada se guarda aquí: la pantalla enseña esto y hasta que alguien
 * confirma se da de alta (app/(admin)/admin/personal/cargar).
 *
 * Las columnas se reconocen por su ENCABEZADO, no por su posición: si la
 * empresa mueve o borra una columna opcional, se sigue leyendo bien.
 *
 * Sin dependencias, para que `node --test` lo importe directo.
 */

/** Encabezado (sin acentos, en minúsculas) → campo. Gana el primero que coincida. */
const COLUMNAS = [
  ["apellido paterno", "apellido_paterno"],
  ["apellido materno", "apellido_materno"],
  ["nombre", "nombre"],
  ["puesto", "puesto"],
  ["area", "area"],
  ["reporta a", "reporta"],
  ["numero de empleado", "numero"],
  ["archivo de la foto", "archivo_foto"],
  ["tipo de sangre", "tipo_sangre"],
  ["alergias", "alergias"],
  ["contacto de emergencia", "contacto_emergencia"],
  ["telefono de emergencia", "telefono_emergencia"],
  ["firmo permiso", "permiso_emergencia"],
  ["foto", "foto"],
];

const clave = (t) => claveDeNombre(t).replace(/[¿?¡!]/g, "").trim();

/** Qué campo es cada columna de un renglón de encabezados; null si no parece serlo. */
function leerEncabezados(celdas) {
  const mapa = {};
  celdas.forEach((celda, col) => {
    const t = clave(celda);
    const hallado = t && COLUMNAS.find(([inicio]) => t.startsWith(inicio));
    if (hallado && !(hallado[1] in mapa)) mapa[hallado[1]] = col;
  });
  return "nombre" in mapa && "puesto" in mapa ? mapa : null;
}

/**
 * Las personas que trae un libro. `hojas` es lo que devuelve `leerXlsx`.
 * Cada una: `{ archivo, hoja, fila, tipo, entrada, reporta, archivoFoto, imagen }`
 * con `entrada` tal como se escribió (sin validar). Los renglones sin nombre,
 * apellidos ni puesto se saltan: la plantilla viene con 40 o 100 renglones
 * numerados y casi nunca se llenan todos.
 */
export function personasDelLibro({ hojas }, archivo = "") {
  const personas = [];
  for (const hoja of hojas || []) {
    const numeros = [...hoja.filas.keys()].sort((a, b) => a - b);
    const filaEncabezado = numeros.slice(0, 15).find((n) => leerEncabezados(hoja.filas.get(n)));
    if (!filaEncabezado) continue; // la hoja de instrucciones, u otra cosa
    const col = leerEncabezados(hoja.filas.get(filaEncabezado));
    // Es la plantilla de administrativos si trae la columna del jefe.
    const tipo = "reporta" in col || clave(hoja.nombre).includes("administrativ") ? "administrativo" : "general";

    for (const n of numeros.filter((x) => x > filaEncabezado)) {
      const celdas = hoja.filas.get(n);
      const de = (campo) => (campo in col ? String(celdas[col[campo]] ?? "").trim() : "");
      if (!de("nombre") && !de("apellido_paterno") && !de("apellido_materno") && !de("puesto")) continue;
      // La foto de ese renglón: la que esté en la columna «Foto», o la única que haya.
      const fotos = (hoja.imagenes || []).filter((i) => i.fila === n);
      const imagen = fotos.find((i) => i.col === col.foto) || (fotos.length === 1 ? fotos[0] : null);
      personas.push({
        archivo,
        hoja: hoja.nombre,
        fila: n,
        tipo,
        entrada: {
          numero: de("numero"),
          nombre: de("nombre"),
          apellido_paterno: de("apellido_paterno"),
          apellido_materno: de("apellido_materno"),
          puesto: de("puesto"),
          area: de("area"),
          tipo,
          tipo_sangre: de("tipo_sangre"),
          alergias: de("alergias"),
          contacto_emergencia: de("contacto_emergencia"),
          telefono_emergencia: de("telefono_emergencia"),
          permiso_emergencia: esSi(de("permiso_emergencia")),
        },
        reporta: de("reporta"),
        archivoFoto: de("archivo_foto"),
        imagen: imagen ? { nombre: imagen.nombre, tipo: imagen.tipo, bytes: imagen.bytes } : null,
      });
    }
  }
  return personas;
}

const sinExtension = (nombre) => clave(String(nombre).replace(/\.[a-z0-9]{2,5}$/i, ""));

/** Busca a quién se refiere un «Reporta a»: nombre completo, o todas sus palabras dentro de un solo nombre. */
function buscarJefe(textoJefe, candidatos) {
  const busca = clave(textoJefe);
  if (!busca) return { hallado: null };
  const exactos = candidatos.filter((c) => c.clave === busca);
  if (exactos.length === 1) return { hallado: exactos[0] };
  if (exactos.length > 1) return { hallado: null, motivo: "hay varias personas con ese nombre" };
  const palabras = busca.split(" ");
  const parecidos = candidatos.filter((c) => palabras.every((p) => c.clave.split(" ").includes(p)));
  if (parecidos.length === 1) return { hallado: parecidos[0] };
  return { hallado: null, motivo: parecidos.length ? "coincide con varias personas" : "no está en el Excel ni en el directorio" };
}

/**
 * La vista previa de la carga. Recibe las personas de todos los libros, los
 * empleados que ya existen y los nombres de las fotos sueltas que se
 * subieron. Devuelve, por persona:
 *   · `estado`: "crear" | "error" (falta algo obligatorio) | "repetida".
 *   · `datos`: lo que se va a guardar, ya limpio.
 *   · `avisos`: lo que no impide crearla pero conviene saber.
 *   · `errores`: por qué no se crea.
 *   · `foto`: "excel" | "archivo" | null, y `archivoFoto` con el nombre hallado.
 *   · `jefe`: { indice } (otra persona de la carga) | { id } (ya existe) | null.
 *
 * Un dato opcional que no se entiende (tipo de sangre, teléfono) NO detiene
 * el alta: se deja vacío y se avisa. Sin teléfono de emergencia, el permiso
 * se quita, porque no habría ficha que enseñar.
 */
export function revisarCarga(personas, { existentes = [], fotosSueltas = [] } = {}) {
  const yaEstan = new Set(existentes.map((e) => claveDeNombre(nombreCompleto(e))));
  const numerosUsados = new Set(existentes.map((e) => String(e.numero || "").toUpperCase()).filter(Boolean));
  const sueltas = new Map(fotosSueltas.map((nombre) => [sinExtension(nombre), nombre]));
  const vistos = new Set();

  const filas = personas.map((p) => {
    const avisos = [];
    const entrada = { ...p.entrada };

    if (entrada.tipo_sangre && !normalizarSangre(entrada.tipo_sangre)) {
      avisos.push(`No se entiende el tipo de sangre «${entrada.tipo_sangre}»: se deja vacío.`);
      entrada.tipo_sangre = "";
    }
    if (entrada.telefono_emergencia && !normalizarTelefono(entrada.telefono_emergencia)) {
      avisos.push(`El teléfono de emergencia «${entrada.telefono_emergencia}» no tiene 10 dígitos (o +1 y 10, si es de Estados Unidos): se deja vacío.`);
      entrada.telefono_emergencia = "";
    }
    if (entrada.permiso_emergencia && !entrada.telefono_emergencia) {
      avisos.push("Firmó el permiso pero no hay teléfono de emergencia: no tendrá ficha de emergencia.");
      entrada.permiso_emergencia = false;
    }
    // Excel guarda "0024" como el número 24: se completa igual que al capturarlo a mano.
    const numero = normalizarNumero(entrada.numero);
    if (numero && (numerosUsados.has(numero) || !/^[A-Z0-9-]{1,12}$/.test(numero))) {
      avisos.push(
        numerosUsados.has(numero)
          ? `El número ${numero} ya lo tiene otra persona: se le pone el siguiente.`
          : `El número «${entrada.numero}» no sirve (solo letras, números y guiones): se le pone el siguiente.`
      );
      entrada.numero = "";
    } else if (numero) numerosUsados.add(numero);

    const v = validarEmpleado(entrada);
    const nombre = nombreCompleto(entrada);
    const suClave = claveDeNombre(nombre);

    let foto = p.imagen ? "excel" : null;
    let archivoFoto = null;
    if (!foto && p.archivoFoto) {
      archivoFoto = sueltas.get(sinExtension(p.archivoFoto)) || null;
      if (archivoFoto) foto = "archivo";
      else avisos.push(`No se subió la foto «${p.archivoFoto}».`);
    }
    if (!foto && !p.archivoFoto) avisos.push("Sin foto.");
    if (!String(entrada.puesto || "").trim()) avisos.push("Sin puesto: su gafete saldría sin él. Se le pone en su ficha.");

    let estado = "crear";
    let errores = [];
    if (!v.ok) {
      estado = "error";
      errores = Object.values(v.errores);
    } else if (yaEstan.has(suClave)) {
      estado = "repetida";
      errores = ["Ya está en el directorio con ese nombre."];
    } else if (vistos.has(suClave)) {
      estado = "repetida";
      errores = ["Viene dos veces en la carga."];
    }
    if (estado === "crear") vistos.add(suClave);

    return {
      ...p, nombre, clave: suClave, estado, errores, avisos,
      datos: v.ok ? v.datos : null, foto, archivoFoto, jefe: null,
    };
  });

  // «Reporta a»: entre los que se van a crear y los administrativos que ya existen.
  const candidatos = [
    ...filas.map((f, indice) => ({ clave: f.clave, indice })).filter((c) => filas[c.indice].estado === "crear"),
    ...existentes.filter((e) => e.estado !== "baja").map((e) => ({ clave: claveDeNombre(nombreCompleto(e)), id: e.id })),
  ];
  filas.forEach((f, indice) => {
    if (f.estado !== "crear" || !f.reporta) return;
    const { hallado, motivo } = buscarJefe(f.reporta, candidatos.filter((c) => c.indice !== indice));
    if (hallado) f.jefe = "id" in hallado ? { id: hallado.id } : { indice: hallado.indice };
    else f.avisos.push(`«Reporta a: ${f.reporta}» ${motivo}: queda sin jefe directo.`);
  });

  const cuenta = (estado) => filas.filter((f) => f.estado === estado).length;
  return {
    filas,
    resumen: {
      crear: cuenta("crear"),
      errores: cuenta("error"),
      repetidas: cuenta("repetida"),
      sinFoto: filas.filter((f) => f.estado === "crear" && !f.foto).length,
      administrativos: filas.filter((f) => f.estado === "crear" && f.tipo === "administrativo").length,
    },
  };
}
