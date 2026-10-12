"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileXls, Images, Printer, Warning } from "@phosphor-icons/react/dist/ssr";
import { leerXlsx } from "@/lib/xlsx-lector.mjs";
import { personasDelLibro, revisarCarga } from "@/lib/excel-personal.mjs";
import { prepararFoto } from "@/lib/foto-gafete";
import { listarPersonal, guardarEmpleado, cerrarCarga } from "../acciones";
import { Insignia, Silueta, prepararImpresion } from "../piezas";
import s from "../personal.module.css";

/**
 * CARGAR LOS EXCEL DE LA EMPRESA.
 *
 * Tres pasos: escoger los archivos, REVISAR lo que traen (qué se crea, qué
 * le falta a cada quien, qué no cuadra) y, hasta entonces, cargar. Los Excel
 * se leen aquí, en el navegador (lib/xlsx-lector.mjs): al servidor solo sube
 * cada persona ya revisada, una por una, con su foto ya recortada. Así la
 * carga se puede seguir en pantalla y, si una persona falla, las demás
 * entran.
 *
 * En la revisión cada quien sale con SU foto al lado: es el momento de ver
 * que la cara corresponde al nombre, antes de que vaya impresa en un gafete.
 */

const CAMPOS = [
  "numero", "nombre", "apellido_paterno", "apellido_materno", "puesto", "area", "tipo",
  "tipo_sangre", "alergias", "contacto_emergencia", "telefono_emergencia",
];

const ESTADO = {
  crear: { clase: "ok", texto: "Se crea" },
  error: { clase: "mal", texto: "No se crea" },
  repetida: { clase: "", texto: "Repetida" },
};

export default function CargarExcel() {
  const router = useRouter();
  const [libros, setLibros] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [revision, setRevision] = useState(null);
  const [aviso, setAviso] = useState("");
  const [fase, setFase] = useState("elegir"); // elegir | revisando | revisar | cargando | listo
  const [avance, setAvance] = useState({ hechos: 0, total: 0 });
  const [resultado, setResultado] = useState(null);
  const campoLibros = useRef(null);
  const campoFotos = useRef(null);

  // La miniatura de cada persona: la foto del Excel o el archivo suelto.
  const miniaturas = useMemo(() => {
    if (!revision) return [];
    return revision.filas.map((f) => {
      if (f.foto === "excel") return URL.createObjectURL(new Blob([f.imagen.bytes], { type: f.imagen.tipo }));
      const suelta = f.foto === "archivo" && fotos.find((x) => x.name === f.archivoFoto);
      return suelta ? URL.createObjectURL(suelta) : null;
    });
  }, [revision, fotos]);
  useEffect(() => () => miniaturas.forEach((u) => u && URL.revokeObjectURL(u)), [miniaturas]);

  const revisar = async () => {
    setAviso("");
    setFase("revisando");
    try {
      const personas = [];
      for (const libro of libros) {
        personas.push(...personasDelLibro(await leerXlsx(await libro.arrayBuffer()), libro.name));
      }
      if (!personas.length) {
        setAviso("No se encontró a nadie en esos archivos. ¿Son las plantillas de Morcast, con la hoja de personas llena?");
        setFase("elegir");
        return;
      }
      const directorio = await listarPersonal();
      if (!directorio.ok) {
        setAviso(directorio.motivo);
        setFase("elegir");
        return;
      }
      setRevision(revisarCarga(personas, { existentes: directorio.empleados, fotosSueltas: fotos.map((f) => f.name) }));
      setFase("revisar");
    } catch (e) {
      setAviso(e?.message || "No se pudieron leer los archivos.");
      setFase("elegir");
    }
  };

  const cargar = async () => {
    // Primero quienes traen su número escrito: a los demás se les pone "el
    // siguiente", y así nunca le ganan el suyo a alguien que sí lo traía.
    const porCrear = revision.filas.map((f, indice) => ({ f, indice })).filter((x) => x.f.estado === "crear")
      .sort((a, b) => Number(Boolean(b.f.datos.numero)) - Number(Boolean(a.f.datos.numero)));
    setFase("cargando");
    setAvance({ hechos: 0, total: porCrear.length });
    const creados = new Map(); // índice en la revisión → id del empleado
    const fallas = [];
    const sinFoto = [];

    for (const [n, { f, indice }] of porCrear.entries()) {
      const datos = new FormData();
      for (const campo of CAMPOS) datos.set(campo, f.datos[campo] ?? "");
      datos.set("permiso_emergencia", f.datos.permiso_emergencia ? "si" : "no");
      const origen = f.foto === "excel"
        ? new Blob([f.imagen.bytes], { type: f.imagen.tipo })
        : f.foto === "archivo" ? fotos.find((x) => x.name === f.archivoFoto) : null;
      if (origen) {
        try {
          datos.set("foto", await prepararFoto(origen, `${f.nombre}.jpg`));
        } catch {
          sinFoto.push(f.nombre); // p. ej. un formato que el navegador no abre
        }
      }
      let r;
      try {
        r = await guardarEmpleado(datos);
      } catch {
        r = { ok: false, motivo: "Se cortó la conexión." };
      }
      if (r.ok) {
        creados.set(indice, r.id);
        if (r.avisos?.length) fallas.push(`${f.nombre}: ${r.avisos.join(" ")}`);
      } else {
        fallas.push(`${f.nombre}: ${[r.motivo, ...Object.values(r.errores || {})].join(" ")}`);
      }
      setAvance({ hechos: n + 1, total: porCrear.length });
    }

    // Ya con todos creados, cada quien con su jefe.
    const jefes = [];
    for (const [indice, id] of creados) {
      const jefe = revision.filas[indice].jefe;
      const idJefe = jefe && ("id" in jefe ? jefe.id : creados.get(jefe.indice));
      if (idJefe) jefes.push({ id, jefe: idJefe });
    }
    if (creados.size) await cerrarCarga({ jefes, creados: creados.size }).catch(() => null);

    setResultado({ ids: [...creados.values()], fallas, sinFoto });
    setFase("listo");
  };

  const reiniciar = () => {
    setLibros([]); setFotos([]); setRevision(null); setResultado(null); setAviso(""); setFase("elegir");
  };

  const r = revision?.resumen;

  return (
    <div className={s.pasos}>
      <div className={`pt-page-head ${s.cabeza}`} style={{ margin: 0 }}>
        <div>
          <h1>Cargar Excel</h1>
          <p>Los dos archivos que devuelve la empresa: administrativos y personal general.</p>
        </div>
        <Link href="/admin/personal" className="pt-btn" prefetch={false}><ArrowLeft /> Personal</Link>
      </div>

      {aviso && (
        <div className={`pt-card ${s.aviso}`} role="alert" style={{ margin: 0 }}>
          <Warning aria-hidden="true" />
          <div><strong>No se pudo revisar</strong><p>{aviso}</p></div>
        </div>
      )}

      {(fase === "elegir" || fase === "revisando") && (
        <section className="pt-card">
          <div className={s.paso}>Paso 1</div>
          <h2 className={s.tituloPaso}>Escoge los archivos</h2>
          <p className={s.nota} style={{ marginTop: 0 }}>
            Son las plantillas «Organigrama administrativo» y «Personal general». Las fotos pueden venir dentro del
            Excel, junto a cada nombre, o sueltas: en ese caso el Excel trae el nombre de cada archivo.
          </p>
          <div className={s.archivos}>
            <div>
              <button type="button" className="pt-btn" onClick={() => campoLibros.current?.click()} disabled={fase === "revisando"}>
                <FileXls /> Archivos de Excel
              </button>
              <input ref={campoLibros} type="file" hidden multiple
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => { setLibros([...e.target.files]); e.target.value = ""; }} />
              <ul className={s.elegidos}>
                {libros.length ? libros.map((l) => <li key={l.name}>{l.name}</li>) : <li>Ninguno todavía.</li>}
              </ul>
            </div>
            <div>
              <button type="button" className="pt-btn" onClick={() => campoFotos.current?.click()} disabled={fase === "revisando"}>
                <Images /> Fotos sueltas (opcional)
              </button>
              <input ref={campoFotos} type="file" hidden multiple accept="image/*"
                onChange={(e) => { setFotos([...e.target.files]); e.target.value = ""; }} />
              <ul className={s.elegidos}>
                <li>{fotos.length ? `${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}` : "Solo si las mandaron aparte del Excel."}</li>
              </ul>
            </div>
          </div>
          <div className={s.pie} style={{ marginTop: "1.1rem" }}>
            <button type="button" className="pt-btn pt-btn-naranja" onClick={revisar} disabled={!libros.length || fase === "revisando"}>
              {fase === "revisando" ? "Leyendo…" : "Revisar antes de cargar"}
            </button>
          </div>
          <p className={s.nota}>Revisar no guarda nada: primero ves qué se va a crear.</p>
        </section>
      )}

      {(fase === "revisar" || fase === "cargando") && revision && (
        <section className="pt-card">
          <div className={s.paso}>Paso 2</div>
          <h2 className={s.tituloPaso}>Revisa lo que se va a crear</h2>
          <div className={s.resumen}>
            <span><b>{r.crear}</b> se {r.crear === 1 ? "crea" : "crean"} ({r.administrativos} administrativos)</span>
            {r.sinFoto > 0 && <span><b>{r.sinFoto}</b> sin foto</span>}
            {r.repetidas > 0 && <span><b>{r.repetidas}</b> {r.repetidas === 1 ? "repetida" : "repetidas"}</span>}
            {r.errores > 0 && <span><b>{r.errores}</b> con datos incompletos</span>}
          </div>
          <p className={s.nota} style={{ marginTop: 0, marginBottom: "0.9rem" }}>
            Fíjate que <strong>cada foto sea de quien dice el nombre</strong>. A quien venga sin foto se le puede subir
            después desde su ficha; lo que diga «No se crea» hay que corregirlo en el Excel y volver a cargarlo.
          </p>

          <div className="pt-tabla-wrap">
            <table className="pt-tabla pt-tabla-compacta" style={{ minWidth: 720 }}>
              <thead>
                <tr><th>Persona</th><th>Área</th><th>Viene de</th><th>Qué pasa</th></tr>
              </thead>
              <tbody>
                {revision.filas.map((f, i) => (
                  <tr key={`${f.archivo}-${f.hoja}-${f.fila}`} style={f.estado === "crear" ? undefined : { opacity: 0.7 }}>
                    <td style={{ minWidth: 230 }}>
                      <div className={s.persona}>
                        <span className={`${s.foto} ${s.fotoMedia}`}>
                          {miniaturas[i] ? <img src={miniaturas[i]} alt="" /> : <Silueta />}
                        </span>
                        <div>
                          <strong>{f.nombre || "Sin nombre"}</strong>
                          <span>{f.entrada.puesto || "Sin puesto"}</span>
                          <span>{f.tipo === "administrativo" ? "Administrativo" : "Personal general"}{f.reporta ? ` · reporta a ${f.reporta}` : ""}</span>
                        </div>
                      </div>
                    </td>
                    <td>{f.entrada.area || <span className={s.gris}>—</span>}</td>
                    <td className={s.gris} style={{ fontSize: "0.8rem" }}>{f.hoja}, renglón {f.fila}</td>
                    <td style={{ minWidth: 220 }}>
                      <Insignia clase={ESTADO[f.estado].clase}>{ESTADO[f.estado].texto}</Insignia>
                      {f.errores.length > 0 && (
                        <ul className={`${s.avisosFila} ${s.mal}`}>{f.errores.map((e) => <li key={e}>{e}</li>)}</ul>
                      )}
                      {f.estado === "crear" && f.avisos.length > 0 && (
                        <ul className={s.avisosFila}>{f.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {fase === "cargando" ? (
            <div role="status">
              <div className={s.avance}><i style={{ width: `${avance.total ? (avance.hechos / avance.total) * 100 : 0}%` }} /></div>
              <p className={s.nota} style={{ marginTop: 0 }}>
                Cargando {avance.hechos} de {avance.total}… No cierres esta página.
              </p>
            </div>
          ) : (
            <div className={s.pie} style={{ marginTop: "1.1rem" }}>
              <button type="button" className="pt-btn pt-btn-naranja" onClick={cargar} disabled={!r.crear}>
                Cargar {r.crear} {r.crear === 1 ? "persona" : "personas"} y emitir sus gafetes
              </button>
              <button type="button" className="pt-btn" onClick={reiniciar}>Escoger otros archivos</button>
            </div>
          )}
        </section>
      )}

      {fase === "listo" && resultado && (
        <section className="pt-card">
          <div className={s.paso}>Paso 3</div>
          <h2 className={s.tituloPaso}>
            {resultado.ids.length} {resultado.ids.length === 1 ? "persona cargada" : "personas cargadas"}
          </h2>
          <p className={s.nota} style={{ marginTop: 0 }}>
            Cada una ya tiene su gafete, con su código y su PIN. Lo que sigue es mandar la hoja a la imprenta y, cuando
            lleguen las tarjetas, grabarles el chip.
          </p>
          {resultado.sinFoto.length > 0 && (
            <ul className={s.avisosFila} style={{ marginTop: "0.8rem", fontSize: "0.86rem" }}>
              <li>No se pudo leer la foto de: {resultado.sinFoto.join(", ")}. Súbela desde su ficha.</li>
            </ul>
          )}
          {resultado.fallas.length > 0 && (
            <ul className={`${s.avisosFila} ${s.mal}`} style={{ marginTop: "0.8rem", fontSize: "0.86rem" }}>
              {resultado.fallas.map((f) => <li key={f}>{f}</li>)}
            </ul>
          )}
          <div className={s.pie} style={{ marginTop: "1.1rem" }}>
            <Link href="/admin/personal" className="pt-btn pt-btn-naranja" prefetch={false}>Ver el personal</Link>
            {resultado.ids.length > 0 && (
              <button type="button" className="pt-btn" onClick={() => router.push(prepararImpresion(resultado.ids))}>
                <Printer /> Hoja para la imprenta
              </button>
            )}
            <button type="button" className="pt-btn" onClick={reiniciar}>Cargar otros archivos</button>
          </div>
        </section>
      )}
    </div>
  );
}
