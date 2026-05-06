// ═══════════════════════════════════════════════════════════════
//  Sparkline · S5-E1 · util Unicode
//  ─────────────────────────────────────────────────────────────
//  Genera mini-gráficos densos como string Unicode.
//  Usado en el boletín de conductor para evolución semanal,
//  distancia diaria, infracciones por día, etc.
//
//  Funciones:
//    · sparklineBars(values)     · ▁▂▃▄▅▆▇ por valor relativo al max
//    · sparklineDots(events, n)  · ··○·●··· por presencia/severidad
//    · sparklineRamp(values)     · normaliza a la altura máxima
//
//  Tufte first · denso, máximo dato por carácter, sin chrome.
//  Funciona idéntico en B&N (caracteres Unicode tienen densidades
//  visuales distintas que el ojo lee como altura).
// ═══════════════════════════════════════════════════════════════

const BARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇"];

/**
 * Genera sparkline de barras Unicode desde array de números.
 * Cada valor se mapea al rango 0-6 (7 niveles) según
 * max-min del array · resultado es string concatenado.
 *
 * Ejemplo:
 *   sparklineBars([10, 30, 50, 80, 60, 40, 20]) → "▁▃▄▆▅▃▂"
 *
 * Si todos los valores son iguales · devuelve barras del medio.
 * Si el array está vacío · devuelve "".
 */
export function sparklineBars(values: number[]): string {
  if (values.length === 0) return "";

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;

  if (range === 0) {
    // todos iguales · devuelve nivel medio
    return (BARS[3] ?? "▄").repeat(values.length);
  }

  return values
    .map((v) => {
      const normalized = (v - min) / range;
      const idx = Math.min(BARS.length - 1, Math.round(normalized * (BARS.length - 1)));
      return BARS[idx] ?? "▄";
    })
    .join("");
}

/**
 * Sparkline de puntos · indica presencia/severidad por día (u otro intervalo).
 * Útil para mostrar "días con infracciones" en una línea.
 *
 * Cada slot se mapea a:
 *   · null  → "·" (no hubo evento)
 *   · "L"   → "○" (leve)
 *   · "M"   → "◐" (media)
 *   · "G"   → "●" (grave)
 *
 * Ejemplo:
 *   sparklineDots([null,null,"L",null,"G","M",null]) → "··○·●◐·"
 */
export function sparklineDots(
  slots: (null | "L" | "M" | "G")[],
): string {
  return slots
    .map((s) => {
      if (s === null) return "·";
      if (s === "L") return "○";
      if (s === "M") return "◐";
      if (s === "G") return "●";
      return "·";
    })
    .join("");
}

/**
 * Sparkline normalizada a un máximo absoluto · útil cuando se
 * sabe que el max teórico es fijo (ej. score 0-100).
 *
 * Ejemplo:
 *   sparklineRamp([84, 76, 77, 70], 100) → "▇▅▅▃"
 */
export function sparklineRamp(values: number[], absoluteMax: number): string {
  if (values.length === 0) return "";
  return values
    .map((v) => {
      const clamped = Math.max(0, Math.min(absoluteMax, v));
      const normalized = clamped / absoluteMax;
      const idx = Math.min(BARS.length - 1, Math.round(normalized * (BARS.length - 1)));
      return BARS[idx] ?? "▄";
    })
    .join("");
}

/**
 * Tendencia de un array · útil para etiquetas como
 * "tendencia ascendente" / "estable" / "descendente".
 *
 * Compara el promedio de la primera mitad vs la segunda.
 * Threshold default · 5% de diferencia para considerar tendencia.
 */
export function tendency(
  values: number[],
  thresholdPct = 5,
): "asc" | "desc" | "flat" {
  if (values.length < 2) return "flat";
  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);
  const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  if (avg1 === 0) return "flat";
  const diffPct = ((avg2 - avg1) / Math.abs(avg1)) * 100;
  if (diffPct > thresholdPct) return "asc";
  if (diffPct < -thresholdPct) return "desc";
  return "flat";
}

export function tendencyLabel(t: "asc" | "desc" | "flat"): string {
  if (t === "asc") return "tendencia ascendente";
  if (t === "desc") return "tendencia descendente";
  return "tendencia estable";
}
