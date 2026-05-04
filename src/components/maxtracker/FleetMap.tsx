"use client";

import { useEffect, useRef } from "react";
import type { FleetAssetLive } from "@/lib/queries/tracking";
import {
  buildFleetMarkerHtml,
  type FleetMarkerColorMode,
} from "./FleetMarker";
import { TILE_SOURCES } from "./mapTileSources";
import styles from "./FleetMap.module.css";

// ═══════════════════════════════════════════════════════════════
//  Basemap tile sources are imported from ./mapTileSources for
//  consistency across all map components.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  FleetMap · the live-tracking map
//  ─────────────────────────────────────────────────────────────
//  Renders all fleet assets as markers with optional clustering.
//  Re-renders markers in place when assets array changes (e.g.
//  simulated movement tick) without re-creating the map.
// ═══════════════════════════════════════════════════════════════

interface FleetMapProps {
  assets: FleetAssetLive[];
  colorMode: FleetMarkerColorMode;
  showPlate: boolean;
  cluster: boolean;
  showTypeIcon: boolean;
  selectedAssetId: string | null;
  onAssetSelect: (id: string) => void;
  /** When changed, fly to this asset's lat/lng */
  flyTarget?: { id: string; nonce: number } | null;
  groupColorById: Record<string, string>;
  /** Optional polyline (last N positions of the selected asset). */
  trailPoints?: Array<{ lat: number; lng: number }>;
  /** Basemap variant */
  layer?: "STANDARD" | "BW" | "SATELLITE" | "SCADA";
}

export default function FleetMap({
  assets,
  colorMode,
  showPlate,
  cluster,
  showTypeIcon,
  selectedAssetId,
  onAssetSelect,
  flyTarget,
  groupColorById,
  trailPoints,
  layer = "STANDARD",
}: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const clusterGroupRef = useRef<any>(null);
  const plainLayerRef = useRef<any>(null);
  const markersByIdRef = useRef<Map<string, any>>(new Map());
  const assetsByIdRef = useRef<Map<string, FleetAssetLive>>(new Map());
  // Snapshot of marker-relevant state from previous render, used
  // to decide whether to call setIcon() on each marker (a no-op
  // setLatLng is fine, but rebuilding the icon HTML every tick
  // is wasteful and causes flicker on Leaflet's side).
  const lastAssetSnapshotRef = useRef<
    Map<
      string,
      {
        motorState: FleetAssetLive["motorState"];
        commState: FleetAssetLive["commState"];
        heading: number;
        plate: string | null;
        groupId: string | null;
        hasOpenAlarm: boolean;
      }
    >
  >(new Map());
  // Cache of "structural" options (cluster / showTypeIcon /
  // showPlate / colorMode). When this changes, every marker
  // needs setIcon() applied.
  const lastStructuralKeyRef = useRef<string>("");
  const trailLayerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const onAssetSelectRef = useRef(onAssetSelect);
  onAssetSelectRef.current = onAssetSelect;
  const initialFitDoneRef = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  // S1-L1 fix F1 · refs para auto-fit reactivo y soft-follow
  const lastVisibleIdsRef = useRef<string>("");
  const lastSelectedPosRef = useRef<{ lat: number; lng: number } | null>(null);

  // ── Init Leaflet once ──────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      // Lazy load markercluster CSS + plugin
      // We use the small subset of markercluster directly here.
      ensureLeafletCss();
      ensureClusterCss();
      // @ts-ignore — markercluster plugin attaches to L
      await import("leaflet.markercluster");

      if (cancelled || !containerRef.current) return;

      LRef.current = L;
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        preferCanvas: false,
        // markercluster requires maxZoom on the map itself when
        // there's no tile layer set yet at construction time.
        // We pick 19 which matches our tile providers' max.
        maxZoom: 19,
      });
      mapRef.current = map;
      map.setView([-34.6037, -58.3816], 5);

      // ── invalidateSize fix ──────────────────────────────
      // When the map is born inside a flex container (multi-map
      // grid, hidden tabs, etc.) Leaflet may compute its initial
      // size before the layout settles, leaving a partial render
      // (blank tiles, broken positioning). Force a re-measure
      // shortly after init.
      requestAnimationFrame(() => {
        setTimeout(() => map.invalidateSize(true), 60);
        setTimeout(() => map.invalidateSize(true), 350);
      });

      // Also re-measure whenever the container resizes (responsive
      // layouts, window resize, multi-map grid changes).
      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        const ro = new ResizeObserver(() => {
          map.invalidateSize(false);
        });
        ro.observe(containerRef.current);
        resizeObserverRef.current = ro;
      }
    })();

    return () => {
      cancelled = true;
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render / update markers when assets or options change ──
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) {
      // Map not ready yet · effect will re-fire when refs are set
      // through any of the deps changing. We also rely on a tiny
      // poll in case nothing changes after init.
      const tick = setInterval(() => {
        if (mapRef.current && LRef.current) {
          clearInterval(tick);
          // Force re-run by touching state — but we don't have a
          // setState here; instead, just call our render function
          // directly:
          render();
        }
      }, 50);
      return () => clearInterval(tick);
    }
    render();

    function render() {
      const L = LRef.current;
      const map = mapRef.current;
      if (!L || !map) return;

      // Layer management: switch between cluster and plain when
      // the cluster toggle changes.
      const wantCluster = cluster;
      const currentLayer = wantCluster
        ? clusterGroupRef.current
        : plainLayerRef.current;
      const otherLayer = wantCluster
        ? plainLayerRef.current
        : clusterGroupRef.current;

      const layerSwitched =
        otherLayer && map.hasLayer(otherLayer); // we're about to swap

      if (otherLayer && layerSwitched) {
        map.removeLayer(otherLayer);
      }

      let layer = currentLayer;
      if (!layer) {
        // Defensive: markerClusterGroup is attached to L by the
        // dynamically imported plugin. If for some reason it's not
        // there yet (e.g. dynamic import still resolving on a
        // re-render), fall back to a regular layerGroup so the
        // map keeps working. The cluster will be created on the
        // next render once the plugin is available.
        // @ts-ignore — markercluster augments L
        const hasCluster = typeof L.markerClusterGroup === "function";
        if (wantCluster && hasCluster) {
          // @ts-ignore
          layer = L.markerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 60,
            spiderfyOnMaxZoom: true,
            chunkedLoading: true,
          });
          clusterGroupRef.current = layer;
        } else {
          layer = L.layerGroup();
          plainLayerRef.current = layer;
        }
      }
      if (!map.hasLayer(layer)) {
        map.addLayer(layer);
      }

      // ─────────────────────────────────────────────────────
      //  IN-PLACE UPDATE STRATEGY
      //  ─────────────────────────────────────────────────
      //  Recreating 80 markers every 250ms causes click handlers
      //  to detach mid-interaction and produces visible flicker.
      //  Instead we keep markers alive across renders and only:
      //    · setLatLng() to move them
      //    · setIcon()   to refresh their HTML when state changes
      //
      //  Markers are recreated only when:
      //    · The layer was switched (cluster ↔ plain)
      //    · The marker doesn't exist yet (new asset, or first render)
      //    · The "structural" options changed (we recreate then
      //      because we'd need to call setIcon anyway and it's
      //      simpler to re-add)
      // ─────────────────────────────────────────────────────

      const seenIds = new Set<string>();
      const latLngs: [number, number][] = [];

      // Recompute structural keys: when these change vs the
      // last render, we need to setIcon() on every marker.
      // Includes `layer` so switching between SCADA / non-SCADA
      // refreshes the pulse halo state on every alarm marker.
      const structuralKey = `${cluster ? 1 : 0}-${showTypeIcon ? 1 : 0}-${showPlate ? 1 : 0}-${colorMode}-${layer}`;
      const structuralChanged = lastStructuralKeyRef.current !== structuralKey;
      lastStructuralKeyRef.current = structuralKey;

      const markerSize = showTypeIcon ? 36 : 26;
      const iconHeight = showPlate ? markerSize + 18 : markerSize;

      for (const a of assets) {
        seenIds.add(a.id);
        latLngs.push([a.lat, a.lng]);
        const groupColor =
          (a.groupId && groupColorById[a.groupId]) || "#1e3a8a";

        let marker = markersByIdRef.current.get(a.id);

        // (Re)build the icon when no marker exists, when we
        // switched layers, or when structural options changed.
        const needsNewMarker = !marker || layerSwitched;
        const needsIconRefresh = needsNewMarker || structuralChanged;

        if (needsNewMarker) {
          const html = buildFleetMarkerHtml({
            motor: a.motorState,
            comm: a.commState,
            heading: a.heading,
            groupColor,
            showPlate,
            plate: a.plate,
            colorMode,
            showTypeIcon,
            vehicleType: a.vehicleType as any,
            hasAlarm: a.hasOpenAlarm,
            pulseAlarm: a.hasOpenAlarm && layer === "SCADA",
          });
          const icon = L.divIcon({
            className: "fleet-marker",
            html,
            iconSize: [markerSize, iconHeight],
            iconAnchor: [markerSize / 2, markerSize / 2],
          });
          marker = L.marker([a.lat, a.lng], { icon });
          marker.on("click", () => onAssetSelectRef.current(a.id));
          layer.addLayer(marker);
          markersByIdRef.current.set(a.id, marker);
        } else {
          // In-place update: most ticks land here.
          marker.setLatLng([a.lat, a.lng]);

          // Detect state-relevant changes since last render:
          // motor / comm / heading / plate / color / alarm flag drive
          // the icon HTML. We rebuild it cheaply (it's a string).
          const prev = lastAssetSnapshotRef.current.get(a.id);
          const changed =
            !prev ||
            prev.motorState !== a.motorState ||
            prev.commState !== a.commState ||
            // round heading to nearest 5° to avoid icon rebuilds
            // every single tick due to micro-drift
            Math.round(prev.heading / 5) !== Math.round(a.heading / 5) ||
            prev.plate !== a.plate ||
            prev.groupId !== a.groupId ||
            prev.hasOpenAlarm !== a.hasOpenAlarm ||
            needsIconRefresh;

          if (changed) {
            const html = buildFleetMarkerHtml({
              motor: a.motorState,
              comm: a.commState,
              heading: a.heading,
              groupColor,
              showPlate,
              plate: a.plate,
              colorMode,
              showTypeIcon,
              vehicleType: a.vehicleType as any,
              hasAlarm: a.hasOpenAlarm,
              pulseAlarm: a.hasOpenAlarm && layer === "SCADA",
            });
            const icon = L.divIcon({
              className: "fleet-marker",
              html,
              iconSize: [markerSize, iconHeight],
              iconAnchor: [markerSize / 2, markerSize / 2],
            });
            marker.setIcon(icon);
          }
        }

        // Snapshot for next-tick diff
        lastAssetSnapshotRef.current.set(a.id, {
          motorState: a.motorState,
          commState: a.commState,
          heading: a.heading,
          plate: a.plate,
          groupId: a.groupId,
          hasOpenAlarm: a.hasOpenAlarm,
        });
        assetsByIdRef.current.set(a.id, a);
      }

      // Remove markers for assets no longer in the list
      for (const [id, marker] of markersByIdRef.current.entries()) {
        if (!seenIds.has(id)) {
          layer.removeLayer(marker);
          markersByIdRef.current.delete(id);
          assetsByIdRef.current.delete(id);
          lastAssetSnapshotRef.current.delete(id);
        }
      }

      // S1-L1 fix F1 · Auto-fit reactivo al cambio del SET de assets visibles.
      // Antes: initialFitDoneRef encuadraba SOLO la primera vez, después
      // respetaba el pan/zoom del usuario. Pero el feedback del PO pedía:
      //   · Si agrego un asset al filtro y queda fuera del recuadro,
      //     el zoom debe alejarse para incluirlo.
      //   · Si saco uno, el zoom debe acercarse a los que quedan.
      // O sea, refit cuando cambia el SET de IDs (no en cada tick por
      // movimiento). Esa lógica vive ahora en un useEffect dedicado más
      // abajo. Acá solo dejamos el initialFit muy mínimo · cubre el
      // caso "primer paint, todavía no entró ningún tick al efecto reactivo".
      if (!initialFitDoneRef.current && latLngs.length > 0) {
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
        initialFitDoneRef.current = true;
      }
    }
  }, [assets, colorMode, showPlate, cluster, showTypeIcon, groupColorById]);

  // ── Tile layer (basemap) ──────────────────────────────────
  // Swaps the underlying tile provider when `layer` changes.
  // Three options: STANDARD (OSM), BW (CartoDB Voyager grayscale),
  // SATELLITE (Esri WorldImagery aerial photos).
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    function apply() {
      const L = LRef.current;
      const map = mapRef.current;
      if (!L || !map) {
        if (cancelled || attempts > 100) return;
        attempts++;
        setTimeout(apply, 50);
        return;
      }

      // Remove old tile layer if any
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
        tileLayerRef.current = null;
      }

      // Pick the source for the requested layer
      const source = TILE_SOURCES[layer];
      const newLayer = L.tileLayer(source.url, {
        attribution: source.attribution,
        maxZoom: source.maxZoom ?? 19,
        subdomains: source.subdomains ?? "abc",
      });
      newLayer.addTo(map);
      tileLayerRef.current = newLayer;
    }

    apply();
    return () => {
      cancelled = true;
    };
  }, [layer]);

  // ── Trail polyline ─────────────────────────────────────────
  // Draws a faint blue line connecting the recent positions of
  // the selected asset (when "show trail" is on). The trail is
  // re-built every time trailPoints changes — it's small (~120
  // points max) so this is cheap.
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    // Always remove the previous trail before drawing a new one
    if (trailLayerRef.current) {
      map.removeLayer(trailLayerRef.current);
      trailLayerRef.current = null;
    }
    if (!trailPoints || trailPoints.length < 2) return;

    const latlngs = trailPoints.map((p) => [p.lat, p.lng] as [number, number]);
    const polyline = L.polyline(latlngs, {
      color: "#2563eb",
      weight: 3,
      opacity: 0.55,
      smoothFactor: 1.5,
      // The 'lineCap' and 'dashArray' make the trail visually
      // distinct from a normal route — a soft suggestion of motion.
      lineCap: "round",
      dashArray: "4 6",
    });
    polyline.addTo(map);
    trailLayerRef.current = polyline;
  }, [trailPoints]);

  // ── Highlight selected asset · persistent styling ─────────
  // When something is selected:
  //   · the selected marker gets a class that scales it 1.3×
  //     and adds a blue halo ring (CSS in FleetMap.module.css)
  //   · the other markers get a class that fades them to 50%
  //     opacity, so the selected one stands out among ~80 others
  // We re-apply this every time selection or assets change so
  // newly-created markers also pick up the right state.
  useEffect(() => {
    // Visit every known marker
    for (const [id, marker] of markersByIdRef.current.entries()) {
      const el = marker.getElement?.();
      if (!el) continue;
      el.classList.remove("fleet-marker-selected");
      el.classList.remove("fleet-marker-dimmed");
      if (selectedAssetId === null) continue;
      if (id === selectedAssetId) {
        el.classList.add("fleet-marker-selected");
      } else {
        el.classList.add("fleet-marker-dimmed");
      }
    }
  }, [selectedAssetId, assets]);

  // ── S1-L1 fix F1 · Auto-fit reactivo al cambio del SET de assets ────
  // Cuando cambia el conjunto de IDs visibles (filtro aplicado, grupo
  // agregado/sacado, etc.) refit el viewport para que los assets nuevos
  // entren y los que se fueron no dejen espacio muerto.
  // Solo se dispara al cambiar el SET, no por movimiento (mismo set
  // de IDs en distintas posiciones · ese caso lo cubre soft-follow).
  // Si hay selectedAssetId, NO refit · respetar el seguimiento.
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    if (selectedAssetId !== null) return; // hay selección · soft-follow gana

    // Compute deterministic key del set de IDs
    const ids = assets.map((a) => a.id).sort().join(",");
    if (ids === lastVisibleIdsRef.current) return; // mismo set · skip
    lastVisibleIdsRef.current = ids;

    if (assets.length === 0) return;
    if (assets.length === 1) {
      const only = assets[0];
      if (!only) return;
      const targetZoom = Math.max(map.getZoom() ?? 12, 12);
      map.setView([only.lat, only.lng], targetZoom, { animate: true });
      return;
    }
    const points = assets.map(
      (a) => [a.lat, a.lng] as [number, number],
    );
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, {
      padding: [60, 60],
      maxZoom: 14,
      animate: true,
    });
  }, [assets, selectedAssetId]);

  // ── S1-L1 fix F1 · Soft-follow del asset seleccionado ────
  // Cuando hay un asset seleccionado y se mueve (cambian sus lat/lng
  // entre ticks del simulador o updates reales), pan suave al nuevo
  // punto SIN cambiar el zoom. Esto resuelve el feedback "no mantiene
  // centrado, se va de escala". Si el user hizo pan/zoom mientras
  // tanto, lo respetamos solo en la dimensión de zoom (el center se
  // re-actualiza al asset, que es el comportamiento "follow" estándar
  // tipo Samsara/Geotab).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selectedAssetId === null) {
      lastSelectedPosRef.current = null;
      return;
    }
    const asset = assets.find((a) => a.id === selectedAssetId);
    if (!asset) return;
    const last = lastSelectedPosRef.current;
    if (last && (last.lat !== asset.lat || last.lng !== asset.lng)) {
      // panTo sin cambiar zoom · animation suave
      map.panTo([asset.lat, asset.lng], { animate: true, duration: 0.5 });
    }
    lastSelectedPosRef.current = { lat: asset.lat, lng: asset.lng };
  }, [assets, selectedAssetId]);

  // ── Fly to a target asset on demand ───────────────────────
  // Re-fires only when the nonce changes. With the CSS fix that
  // applies selection styling to the inner wrapper (not the root
  // Leaflet positions), the marker stays visible throughout the
  // animation · no need for cluster.zoomToShowLayer tricks.
  useEffect(() => {
    if (!flyTarget) return;
    const map = mapRef.current;
    if (!map) return;
    const asset = assetsByIdRef.current.get(flyTarget.id);
    if (!asset) return;
    const targetZoom = Math.max(map.getZoom(), 14);
    map.flyTo([asset.lat, asset.lng], targetZoom, { duration: 0.8 });

    // If clustering is on AND the marker is currently absorbed by
    // a cluster bubble at the destination zoom, ask the plugin
    // to expand around it. This is a defensive call · the marker
    // root stays positioned correctly either way thanks to the
    // CSS fix, but expansion is what makes the user actually see
    // the individual icon (vs a cluster bubble + halo).
    const cluster = clusterGroupRef.current;
    const marker = markersByIdRef.current.get(flyTarget.id);
    if (cluster && marker && typeof cluster.zoomToShowLayer === "function") {
      setTimeout(() => {
        try {
          cluster.zoomToShowLayer(marker, () => {});
        } catch {
          /* fallthrough */
        }
      }, 350);
    }
  }, [flyTarget?.nonce, flyTarget?.id]);

  return <div ref={containerRef} className={styles.map} />;
}

function ensureLeafletCss() {
  if (typeof document === "undefined") return;
  const id = "leaflet-css";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

function ensureClusterCss() {
  if (typeof document === "undefined") return;
  for (const css of [
    {
      id: "leaflet-mc-css",
      href: "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css",
    },
    {
      id: "leaflet-mc-default-css",
      href: "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css",
    },
  ]) {
    if (document.getElementById(css.id)) continue;
    const link = document.createElement("link");
    link.id = css.id;
    link.rel = "stylesheet";
    link.href = css.href;
    document.head.appendChild(link);
  }
}
