// ═══════════════════════════════════════════════════════════════
//  Geo waypoints for the seed
//  ─────────────────────────────────────────────────────────────
//  Real Argentine geographic anchors used to interpolate
//  realistic GPS tracks. Coordinates were sampled from public
//  map data (OSM); they are coarse on purpose because we want
//  the routes to look real-ish, not pinpoint accurate.
//
//  Each route is a list of [lat, lng] waypoints. The seed
//  interpolates between consecutive waypoints and adds light
//  jitter to simulate natural GPS variation.
// ═══════════════════════════════════════════════════════════════

export type Waypoint = readonly [lat: number, lng: number];
export type Route = readonly Waypoint[];

// ── Transportes del Sur · Ruta 1: Buenos Aires → Mar del Plata ──
//    (RN2 — ~400 km, atraviesa La Plata, Las Flores, Dolores)
export const ROUTE_BSAS_MAR_DEL_PLATA: Route = [
  [-34.6037, -58.3816], // Microcentro CABA
  [-34.7270, -58.2500], // Avellaneda / Wilde
  [-34.9214, -57.9544], // La Plata
  [-35.4500, -57.9000], // Chascomús
  [-36.0153, -59.1067], // Las Flores
  [-36.3140, -57.6800], // Dolores
  [-36.7800, -57.5200], // Maipú
  [-37.3214, -57.0260], // Mar Chiquita
  [-38.0055, -57.5426], // Mar del Plata
];

// ── Transportes del Sur · Ruta 2: Buenos Aires → Bahía Blanca ──
//    (RN3 — ~700 km, atraviesa Azul, Tres Arroyos)
export const ROUTE_BSAS_BAHIA_BLANCA: Route = [
  [-34.6037, -58.3816], // CABA
  [-34.9905, -58.0166], // Cañuelas
  [-35.4400, -58.0700], // Monte / Lobos
  [-36.7779, -59.8581], // Azul
  [-37.3217, -59.1326], // Tandil
  [-37.9981, -60.7800], // Coronel Suárez
  [-38.3870, -60.2769], // Tres Arroyos
  [-38.7196, -62.2724], // Bahía Blanca
];

// ── Transportes del Sur · Ruta 3: Reparto urbano CABA-GBA ──
export const ROUTE_GBA_REPARTO: Route = [
  [-34.5870, -58.4170], // Belgrano
  [-34.5990, -58.4290], // Colegiales
  [-34.6160, -58.4280], // Villa Crespo
  [-34.6010, -58.4710], // Caballito
  [-34.6080, -58.4980], // Flores
  [-34.6450, -58.5000], // Liniers
  [-34.6730, -58.5670], // Ramos Mejía
  [-34.6510, -58.6190], // Morón
  [-34.6710, -58.5570], // San Justo
  [-34.6230, -58.4360], // Almagro
  [-34.5870, -58.4170], // Belgrano (loop close)
];

// ── GBA Norte · Pacheco, San Fernando, Tigre ──
//    Inferred from real CSV data (vehicles working in zona norte)
export const ROUTE_GBA_NORTE: Route = [
  [-34.45330, -58.59210], // Pacheco
  [-34.46850, -58.55320], // San Fernando
  [-34.42660, -58.57670], // Tigre
  [-34.47120, -58.51150], // Vicente López
  [-34.51840, -58.48990], // Olivos
];

// ── GBA Sur · Avellaneda, Quilmes, Berazategui ──
export const ROUTE_GBA_SUR: Route = [
  [-34.66260, -58.36420], // Avellaneda
  [-34.69630, -58.41020], // Lanús
  [-34.72100, -58.27380], // Quilmes
  [-34.76430, -58.21410], // Berazategui
  [-34.83020, -58.16800], // Florencio Varela
];

// ── Mendoza-San Rafael · Cuyo long-haul ──
//    Real route inferred from production data
export const ROUTE_MENDOZA_SAN_RAFAEL: Route = [
  [-32.89080, -68.84580], // Mendoza centro
  [-33.07500, -68.87700], // Luján de Cuyo
  [-33.30310, -69.00410], // Túpungato área
  [-33.85420, -68.84920], // Tunuyán
  [-34.61650, -68.33000], // San Rafael
];

// ── Comodoro Rivadavia · Patagonia oil routes ──
export const ROUTE_PATAGONIA_COMODORO: Route = [
  [-45.84570, -67.88800], // Comodoro Rivadavia
  [-45.93220, -67.55480], // Comodoro Sur (zona industrial)
  [-46.07550, -67.94320], // Rada Tilly
  [-45.74310, -67.69960], // Restinga Alí
  [-45.84570, -67.88800], // Loop close
];

// ── Caleta Olivia · Patagonia south ──
export const ROUTE_PATAGONIA_CALETA: Route = [
  [-46.46000, -67.53240], // Caleta Olivia
  [-46.49880, -67.49190], // Pico Truncado área
  [-46.79150, -67.96450], // Cañadón Seco
  [-47.27300, -65.93450], // Puerto Deseado
  [-46.46000, -67.53240], // Loop close
];

// ── Minera La Cumbre · Polígono operativo Catamarca NW ──
//    (zona Bajo de la Alumbrera-style)
export const ROUTE_MINA_CATAMARCA: Route = [
  [-27.3170, -66.6020], // Site Alpha (entrada)
  [-27.3320, -66.6240], // Pit Norte
  [-27.3520, -66.6310], // Pit Central
  [-27.3690, -66.6200], // Planta procesamiento
  [-27.3580, -66.5980], // Acopio
  [-27.3370, -66.5910], // Báscula
  [-27.3170, -66.6020], // Loop close
];

// ── Minera La Cumbre · Silos / activos fijos ──
//    Una posición fija (nunca se mueve)
export const FIXED_SILO_POSITIONS: readonly Waypoint[] = [
  [-27.3690, -66.6200], // Silo 1 (junto a planta)
  [-27.3700, -66.6210], // Silo 2
  [-27.3585, -66.5985], // Silo 3 (acopio)
  [-27.3590, -66.5990], // Silo 4
  [-27.3375, -66.5915], // Silo 5 (báscula)
];

// ── Rappi Cono Sur · Grilla CABA ──
//    Riders se mueven dentro de polígonos de Palermo, Recoleta,
//    Belgrano, Villa Crespo. Generamos puntos random dentro de
//    bounding boxes en vez de rutas explícitas.
export const CABA_BOUNDS = {
  PALERMO:      { latMin: -34.5800, latMax: -34.5680, lngMin: -58.4350, lngMax: -58.4150 },
  RECOLETA:     { latMin: -34.5950, latMax: -34.5830, lngMin: -58.4000, lngMax: -58.3850 },
  BELGRANO:     { latMin: -34.5700, latMax: -34.5530, lngMin: -58.4650, lngMax: -58.4450 },
  VILLA_CRESPO: { latMin: -34.6050, latMax: -34.5930, lngMin: -58.4500, lngMax: -58.4300 },
} as const;

// ── Vehicle make/model catalog (per industry) ──
export const TRUCK_MODELS = [
  { make: "Mercedes-Benz", model: "Actros 2645" },
  { make: "Mercedes-Benz", model: "Atego 1726" },
  { make: "Scania",        model: "R 450" },
  { make: "Scania",        model: "G 410" },
  { make: "Volvo",         model: "FH 460" },
  { make: "Volvo",         model: "VM 270" },
  { make: "Iveco",         model: "Stralis 480" },
  { make: "Iveco",         model: "Tector 170E22" },
  { make: "Ford",          model: "Cargo 1722" },
] as const;

export const MINING_VEHICLES = [
  { make: "Caterpillar", model: "777G" },
  { make: "Caterpillar", model: "793F" },
  { make: "Komatsu",     model: "HD785-7" },
  { make: "Komatsu",     model: "HD605-8" },
  { make: "Belaz",       model: "75131" },
] as const;

export const MOTORCYCLE_MODELS = [
  { make: "Honda",   model: "CG 150" },
  { make: "Honda",   model: "Wave 110" },
  { make: "Yamaha",  model: "YBR 125" },
  { make: "Yamaha",  model: "FZ 16" },
  { make: "Bajaj",   model: "Rouser 200" },
  { make: "Suzuki",  model: "GN 125" },
] as const;

export const SILO_MODELS = [
  { make: "Vesa",    model: "VS-200" },
  { make: "Saimon",  model: "S-1000" },
] as const;
