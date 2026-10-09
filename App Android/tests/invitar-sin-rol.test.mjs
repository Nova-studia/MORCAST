import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Revisión 9-oct: al INVITAR, un rol vacío = "Administrador completo" en el
// servidor (rolDeInvitado). Ofrecer "Sin rol (solo el Panel)" ahí mentía.
// En EDITAR sí es verdad (rol_id null = solo el Panel) y se queda.
test("el alta de un administrador no ofrece 'Sin rol'", () => {
  const s = readFileSync(new URL("../src/pantallas/admin/Usuarios.js", import.meta.url), "utf8");
  const ini = s.indexOf("Rol (qué puede hacer)");
  const fin = s.indexOf("Enviar invitación", ini);
  assert.ok(ini > 0 && fin > ini);
  assert.ok(!s.slice(ini, fin).includes("Sin rol"));
});
