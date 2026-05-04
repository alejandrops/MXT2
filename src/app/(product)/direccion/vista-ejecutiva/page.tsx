import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  /direccion/vista-ejecutiva · ELIMINADO · redirect a /dashboard
//  ─────────────────────────────────────────────────────────────
//  S1-L2 ia-reorg · Esta pantalla mostraba el "ahora" cross-módulo
//  pero estaba mal hecha. Se decidió:
//    · Dirección queda como espacio de análisis estadístico
//      (Comparativas, Correlaciones, Comparativa entre objetos,
//      Boletín ejecutivo) · todo analítico sobre períodos.
//    · El "ahora" cross-módulo (estado en vivo de la flota) vive
//      en /dashboard como home del sistema · pantalla nueva.
//
//  Distinción conceptual:
//    Dashboard = operacional ("ahora")
//    Dirección = analítico (período histórico)
//
//  El redirect preserva bookmarks viejos.
// ═══════════════════════════════════════════════════════════════

export default function RedirectVistaEjecutiva() {
  redirect("/dashboard");
}
