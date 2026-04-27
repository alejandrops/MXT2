// ═══════════════════════════════════════════════════════════════
//  Maxtracker components · single import surface
// ═══════════════════════════════════════════════════════════════

// Primitives & layout
export { KpiTile } from "./KpiTile";
export { SectionHeader } from "./SectionHeader";
export { StatusPill } from "./StatusPill";
export { Tabs, type TabDef } from "./Tabs";
export { LeafletMap } from "./LeafletMap";

// Cards
export { AlarmCard } from "./AlarmCard";
export { DriverScoreCard } from "./DriverScoreCard";
export { AssetEventCard } from "./AssetEventCard";
export { EventRow } from "./EventRow";

// Tables & lists
export { SortHeader } from "./SortHeader";
export { Pagination } from "./Pagination";
export { AssetFilterBar } from "./AssetFilterBar";
export { AssetTable } from "./AssetTable";
export { DriverFilterBar } from "./DriverFilterBar";
export { DriverTable } from "./DriverTable";
export { AlarmFilterBar } from "./AlarmFilterBar";
export { EventFilterBar } from "./EventFilterBar";
export { DriverEventFilterBar } from "./DriverEventFilterBar";
export { DriverAlarmFilterBar } from "./DriverAlarmFilterBar";
export { HistoricosFilterBar } from "./HistoricosFilterBar";
export { AssetCombobox } from "./AssetCombobox";
export type { AssetOption } from "./AssetCombobox";

// Playback (Históricos)
export { TimelineScrubber } from "./TimelineScrubber";
export { TripDetailPanel } from "./TripDetailPanel";
export { TripContextHeader } from "./TripContextHeader";
export { SegmentList } from "./SegmentList";
export { SegmentTimeline } from "./SegmentTimeline";
export { LivePositionPanel } from "./LivePositionPanel";
export { TelemetryPanel } from "./TelemetryPanel";
export { SpeedChart } from "./SpeedChart";
export { MetricChart } from "./MetricChart";
export type { MetricKey } from "./MetricChart";

// Live tracking (Mapa)
export { FleetSidebar } from "./FleetSidebar";
export { AssetDetailPanel } from "./AssetDetailPanel";
export { MapLayerToggle } from "./MapLayerToggle";
export type { MapLayer } from "./MapLayerToggle";
export { ViewOptionsPopover, DEFAULT_VIEW_OPTIONS } from "./ViewOptionsPopover";
export type { ViewOptions } from "./ViewOptionsPopover";

// Multi-map view
export { GridLayoutToggle, gridSlotCount } from "./GridLayoutToggle";
export type { GridLayout } from "./GridLayoutToggle";
export { MultiMapGrid } from "./MultiMapGrid";
export type { SelectionMode } from "./MultiMapGrid";
export { MiniMap } from "./MiniMap";
export { VehicleSelectorModal } from "./VehicleSelectorModal";

// Page composites
export { AssetHeader } from "./AssetHeader";
export { AssetLiveStatus } from "./AssetLiveStatus";
export { AssetMapTab } from "./AssetMapTab";
export { AssetDayRouteCard } from "./AssetDayRouteCard";
export { AssetDriversPanel } from "./AssetDriversPanel";
export { DriverAssetsPanel } from "./DriverAssetsPanel";
export { AssetDriversHeatmap } from "./AssetDriversHeatmap";
export { PersonHeader } from "./PersonHeader";
export { ActivityHeatmap } from "./ActivityHeatmap";
