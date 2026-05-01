// ═══════════════════════════════════════════════════════════════
//  ThemeBoot · inline script para evitar flash de tema incorrecto
//  ─────────────────────────────────────────────────────────────
//  Se inyecta como <script> al inicio del <body> · antes del
//  primer paint. Lee la cookie `mxt-theme` (light|dark) y la
//  aplica como data-theme en <html>.
//
//  Si no hay cookie y el OS prefiere dark, aplica dark. Si no,
//  light (default).
// ═══════════════════════════════════════════════════════════════

export function ThemeBoot() {
  const code = `
    (function() {
      try {
        var match = document.cookie.match(/(?:^|; )mxt-theme=(light|dark)/);
        if (match) {
          document.documentElement.dataset.theme = match[1];
          return;
        }
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
      } catch(e) {
        document.documentElement.dataset.theme = 'light';
      }
    })();
  `;
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
