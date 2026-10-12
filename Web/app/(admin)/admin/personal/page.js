"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileXls,
  TreeStructure,
  ContactlessPayment,
  Printer,
  Warning,
  MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr";
import { nombreCompleto, filtrarPersonal, faltantes } from "@/lib/personal.mjs";
import { listarPersonal } from "./acciones";
import { Foto, EstadoGafete, prepararImpresion } from "./piezas";
import s from "./personal.module.css";

/**
 * PERSONAL Y GAFETES — el directorio (db/032).
 *
 * De aquí salen el alta, la carga del Excel de la empresa, el organigrama,
 * la hoja para la imprenta y la pantalla de grabar chips. Los datos de
 * emergencia no viajan a esta lista: solo se ven en la ficha de cada quien.
 */

const FILTROS = [
  { id: "activos", texto: "Activos", filtro: { estado: "activo" } },
  { id: "administrativos", texto: "Administrativos", filtro: { estado: "activo", tipo: "administrativo" } },
  { id: "general", texto: "Personal general", filtro: { estado: "activo", tipo: "general" } },
  // Lo que falta por terminar: mandarlo a la imprenta y, ya impreso, grabarle el chip.
  { id: "imprimir", texto: "Sin imprimir", filtro: { sinImprimir: true } },
  { id: "chip", texto: "Chip pendiente", filtro: { chip: true } },
  { id: "baja", texto: "De baja", filtro: { estado: "baja" } },
];

const TEXTO_FALTA = { foto: "Falta la foto", puesto: "Falta el puesto" };

export default function PersonalAdmin() {
  const router = useRouter();
  const [carga, setCarga] = useState(null); // lo que contestó el servidor
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState("activos");
  const [marcados, setMarcados] = useState(() => new Set());

  useEffect(() => {
    let vivo = true;
    listarPersonal().then((r) => { if (vivo) setCarga(r); });
    return () => { vivo = false; };
  }, []);

  const empleados = useMemo(() => (carga?.ok ? carga.empleados : []), [carga]);
  const cuenta = (f) => filtrarPersonal(empleados, f.filtro).length;
  const lista = useMemo(
    () => filtrarPersonal(empleados, { ...FILTROS.find((f) => f.id === filtro).filtro, texto }),
    [empleados, filtro, texto]
  );

  // Solo se imprime a quien tiene gafete vigente.
  const imprimibles = lista.filter((e) => e.estado === "activo" && e.gafete);
  const marcadosVisibles = imprimibles.filter((e) => marcados.has(e.id));
  const todosMarcados = imprimibles.length > 0 && marcadosVisibles.length === imprimibles.length;

  const alternar = (id) => setMarcados((m) => {
    const otro = new Set(m);
    if (otro.has(id)) otro.delete(id); else otro.add(id);
    return otro;
  });
  const alternarTodos = () => setMarcados((m) => {
    const otro = new Set(m);
    for (const e of imprimibles) { if (todosMarcados) otro.delete(e.id); else otro.add(e.id); }
    return otro;
  });
  const imprimir = () => router.push(prepararImpresion(marcadosVisibles.map((e) => e.id)));

  const activos = empleados.filter((e) => e.estado === "activo").length;
  const sinImprimir = filtrarPersonal(empleados, { sinImprimir: true }).length;
  const pendientes = filtrarPersonal(empleados, { chip: true }).length;

  return (
    <>
      <div className={`pt-page-head ${s.cabeza}`}>
        <div>
          <h1>Personal y gafetes</h1>
          <p>
            {carga?.ok
              ? <>{activos} {activos === 1 ? "empleado activo" : "empleados activos"}{sinImprimir > 0 && <> · {sinImprimir} sin imprimir</>}{pendientes > 0 && <> · {pendientes} con el chip pendiente</>}</>
              : "El directorio del personal y sus gafetes con QR y chip."}
          </p>
        </div>
        <div className={s.acciones}>
          <Link href="/admin/personal/organigrama" className="pt-btn" prefetch={false}><TreeStructure /> Organigrama</Link>
          <Link href="/admin/personal/chips" className="pt-btn" prefetch={false}><ContactlessPayment /> Grabar chips</Link>
          <Link href="/admin/personal/cargar" className="pt-btn" prefetch={false}><FileXls /> Cargar Excel</Link>
          <Link href="/admin/personal/nuevo" className="pt-btn pt-btn-naranja" prefetch={false}><Plus /> Nuevo empleado</Link>
        </div>
      </div>

      {carga && !carga.ok && (
        <div className={`pt-card ${s.aviso}`} role="alert">
          <Warning aria-hidden="true" />
          <div>
            <strong>{carga.sinTablas ? "La base todavía no tiene las tablas del personal" : "No se pudo abrir el directorio"}</strong>
            <p>
              {carga.sinTablas
                ? <>Falta correr <code>db/032-personal-gafetes.sql</code> en Supabase. Hasta entonces esta sección no guarda nada.</>
                : carga.motivo}
            </p>
          </div>
        </div>
      )}
      {carga?.ok && carga.sinLlave && (
        <div className={`pt-card ${s.aviso}`} role="alert">
          <Warning aria-hidden="true" />
          <div>
            <strong>Todavía no se pueden emitir gafetes</strong>
            <p>
              Falta la variable <code>PERSONAL_PIN_LLAVE</code> en el servidor (Vercel). Con ella se cifra el PIN de
              emergencia de cada gafete. Se puede dar de alta al personal, pero su gafete se emite hasta que exista.
            </p>
          </div>
        </div>
      )}

      <div className={s.barra}>
        <label className={s.buscar} style={{ position: "relative" }}>
          <MagnifyingGlass aria-hidden="true" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--mc-gris)" }} />
          <input
            className="pt-input"
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Nombre, puesto, número o código"
            aria-label="Buscar en el personal"
            style={{ paddingLeft: "2.3rem", width: "100%" }}
          />
        </label>
        <div className={s.filtros}>
          {FILTROS.map((f) => (
            <button key={f.id} type="button" className={`pt-chip ${filtro === f.id ? "activo" : ""}`} onClick={() => setFiltro(f.id)}>
              {f.texto} ({cuenta(f)})
            </button>
          ))}
        </div>
      </div>

      {marcadosVisibles.length > 0 && (
        <div className={s.seleccion} role="status">
          <span>
            {marcadosVisibles.length} {marcadosVisibles.length === 1 ? "gafete marcado" : "gafetes marcados"}
          </span>
          <div className={s.acciones}>
            <button type="button" className="pt-btn" onClick={() => setMarcados(new Set())}>Quitar marcas</button>
            {/* Sin el azul: en esta pantalla la acción principal es «Nuevo empleado». */}
            <button type="button" className="pt-btn" onClick={imprimir}><Printer /> Hoja para la imprenta</button>
          </div>
        </div>
      )}

      <div className="pt-card">
        {!carga ? (
          <div className="pt-vacio">Cargando el personal…</div>
        ) : lista.length === 0 ? (
          <div className="pt-vacio">
            {empleados.length === 0
              ? <>Todavía no hay nadie. Da de alta al primero con <strong>Nuevo empleado</strong>, o carga los Excel de la empresa.</>
              : "Nadie coincide con esa búsqueda o ese filtro."}
          </div>
        ) : (
          <div className="pt-tabla-wrap">
            <table className="pt-tabla pt-tabla-compacta" style={{ minWidth: 780 }}>
              <thead>
                <tr>
                  <th style={{ width: 34 }}>
                    <input
                      type="checkbox"
                      className={s.marca}
                      checked={todosMarcados}
                      disabled={imprimibles.length === 0}
                      onChange={alternarTodos}
                      aria-label="Marcar todos los que se ven"
                    />
                  </th>
                  <th>Empleado</th>
                  <th>No.</th>
                  <th>Área</th>
                  <th>Gafete</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {lista.map((e) => {
                  const falta = e.estado === "activo" ? faltantes(e) : [];
                  const imprimible = e.estado === "activo" && Boolean(e.gafete);
                  return (
                    <tr key={e.id} style={e.estado === "baja" ? { opacity: 0.6 } : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          className={s.marca}
                          checked={marcados.has(e.id)}
                          disabled={!imprimible}
                          onChange={() => alternar(e.id)}
                          aria-label={`Marcar a ${nombreCompleto(e)} para imprimir`}
                        />
                      </td>
                      <td style={{ minWidth: 240 }}>
                        <div className={s.persona}>
                          <Foto empleado={e} />
                          <div>
                            <strong>{nombreCompleto(e)}</strong>
                            <span>{e.puesto || "Sin puesto"}{e.tipo === "administrativo" ? " · Administrativo" : ""}</span>
                            {falta.map((f) => <span key={f} className={s.falta}>{TEXTO_FALTA[f]}</span>)}
                          </div>
                        </div>
                      </td>
                      <td className="folio">{e.numero}</td>
                      <td>{e.area || <span className={s.gris}>—</span>}</td>
                      <td>
                        <EstadoGafete empleado={e} />
                        {e.gafete && e.estado === "activo" && (
                          <span className={`${s.mono} ${s.gris}`} style={{ display: "block", fontSize: "0.76rem", marginTop: 4 }}>{e.gafete.codigo}</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link href={`/admin/personal/${e.id}`} className="pt-btn" prefetch={false} aria-label={`Abrir la ficha de ${nombreCompleto(e)}`}>
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
