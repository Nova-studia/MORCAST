"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { armarOrganigrama, nombreCompleto } from "@/lib/personal.mjs";
import { listarPersonal } from "../acciones";
import { Foto } from "../piezas";
import s from "../personal.module.css";

/**
 * EL ORGANIGRAMA: los administrativos activos, en árbol por «Reporta a».
 * El árbol lo arma lib/personal.mjs; aquí solo se dibuja. El jefe directo
 * de cada quien se cambia en su ficha.
 */
export default function Organigrama() {
  const [carga, setCarga] = useState(null);

  useEffect(() => {
    let vivo = true;
    listarPersonal().then((r) => { if (vivo) setCarga(r); });
    return () => { vivo = false; };
  }, []);

  const arbol = useMemo(() => (carga?.ok ? armarOrganigrama(carga.empleados) : []), [carga]);
  const total = carga?.ok ? carga.empleados.filter((e) => e.tipo === "administrativo" && e.estado === "activo").length : 0;

  return (
    <>
      <div className={`pt-page-head ${s.cabeza}`}>
        <div>
          <h1>Organigrama</h1>
          <p>{carga?.ok ? `${total} ${total === 1 ? "administrativo" : "administrativos"}, por jefe directo` : "El personal administrativo, por jefe directo."}</p>
        </div>
        <Link href="/admin/personal" className="pt-btn" prefetch={false}><ArrowLeft /> Personal</Link>
      </div>

      <div className="pt-card">
        {!carga ? (
          <div className="pt-vacio">Cargando el organigrama…</div>
        ) : !carga.ok ? (
          <div className="pt-vacio">{carga.motivo}</div>
        ) : arbol.length === 0 ? (
          <div className="pt-vacio">
            Todavía no hay personal administrativo. Al darlos de alta, escoge en «Reporta a» a su jefe directo.
          </div>
        ) : (
          <ul className={s.arbol}>
            {arbol.map((nodo) => <Rama key={nodo.id} nodo={nodo} />)}
          </ul>
        )}
      </div>
    </>
  );
}

function Rama({ nodo }) {
  const aCargo = nodo.subordinados.length;
  return (
    <li>
      <Link href={`/admin/personal/${nodo.id}`} className={s.nodo} prefetch={false}>
        <Foto empleado={nodo} />
        <div>
          <strong>{nombreCompleto(nodo)}</strong>
          <span>{nodo.puesto || "Sin puesto"}{nodo.area ? ` · ${nodo.area}` : ""}</span>
          {aCargo > 0 && <em>{aCargo} a su cargo</em>}
        </div>
      </Link>
      {aCargo > 0 && (
        <ul>
          {nodo.subordinados.map((hijo) => <Rama key={hijo.id} nodo={hijo} />)}
        </ul>
      )}
    </li>
  );
}
