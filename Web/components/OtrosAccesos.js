"use client";

import Link from "next/link";
import {
  User,
  ShieldCheck,
  Truck,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Los otros dos accesos, al pie de cada login.
 *
 * EL PROBLEMA QUE RESUELVE
 * Los enlaces entre los tres logins estaban puestos a mano, cada pantalla por
 * su cuenta, y quedó un hueco: al **modo chofer NO SE LLEGABA DESDE NINGÚN
 * LADO**. La pantalla existía y funcionaba, pero el único camino era teclear
 * /chofer/login en la barra de direcciones. Desde el portal se llegaba a
 * administración, y desde administración y chofer se volvía al portal; nadie
 * apuntaba al chofer.
 *
 * Al armarse de una tabla, agregar un cuarto acceso mañana es un renglón, y
 * es imposible que vuelva a faltar uno: cada login muestra los que NO son él.
 */
const ACCESOS = [
  { id: "cliente", href: "/portal/login", texto: "Soy cliente", icono: User },
  { id: "chofer", href: "/chofer/login", texto: "Soy chofer", icono: Truck },
  { id: "admin", href: "/admin/login", texto: "Administración", icono: ShieldCheck },
];

/** @param {{actual: "cliente" | "chofer" | "admin"}} props */
export default function OtrosAccesos({ actual }) {
  const otros = ACCESOS.filter((a) => a.id !== actual);

  return (
    <div className="pt-accesos">
      <span className="pt-accesos-tit">¿Entras de otra forma?</span>
      <div className="pt-accesos-fila">
        {otros.map(({ id, href, texto, icono: Ico }) => (
          <Link key={id} href={href} className="pt-acceso">
            <Ico aria-hidden="true" />
            {texto}
          </Link>
        ))}
      </div>
    </div>
  );
}
