import { test } from "node:test";
import assert from "node:assert/strict";

// ---- Revisión final de la Entrega 3: la app avisa con SU folio ----
test("el aviso de la app encuentra la solicitud aunque la base le haya cambiado el folio", async () => {
  const { filtroFolioAviso } = await import("../lib/solicitud-aviso.mjs");
  assert.equal(filtroFolioAviso("REC-2026-0004"), "folio.eq.REC-2026-0004,folio_pedido.eq.REC-2026-0004");
  assert.equal(filtroFolioAviso("REC-2026-0004,cliente_id.neq.x"), null, "nada que no sea un folio entra al filtro");
});
