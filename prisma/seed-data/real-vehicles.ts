// ═══════════════════════════════════════════════════════════════
//  Real vehicles catalog · auto-generated from CSVs in
//  ./real-trajectories/ · 23 vehicles with real telemetry data
//  covering 20-26 April 2026 (one week, ~2k-10k samples each).
//
//  Geographic distribution:
//    · Cuyo       2 vehicles
//    · GBA        13 vehicles
//    · NOA        1 vehicles
//    · Pampa      2 vehicles
//    · Patagonia  5 vehicles
//
//  Type distribution:
//    · CAR         1 vehicles
//    · MOTORCYCLE  6 vehicles
//    · TRUCK       16 vehicles
//
//  Classification rules:
//    · max speed > 150 km/h     → CAR (likely a pickup or executive)
//    · GBA + max < 95 km/h      → MOTORCYCLE (delivery profile)
//    · everything else          → TRUCK
// ═══════════════════════════════════════════════════════════════

export interface RealVehicleSpec {
  csvFile: string;
  plate: string;
  name: string;
  make: string;
  model: string;
  vehicleType: "CAR" | "MOTORCYCLE" | "TRUCK";
  region: "GBA" | "Cuyo" | "Patagonia" | "NOA" | "Pampa";
  profile: "urbano" | "larga-distancia" | "mixto";
}

export const REAL_VEHICLES: RealVehicleSpec[] = [
  {
    csvFile: "Historico-AG222UF-20260420-20260426.csv",
    plate: "AG222UF",
    name: "Camioneta AG222",
    make: "Toyota",
    model: "Hilux 4x4",
    vehicleType: "CAR",
    region: "Patagonia",
    profile: "larga-distancia",
  },
  {
    csvFile: "Historico-AC050ZU-20260420-20260426.csv",
    plate: "AC050ZU",
    name: "Moto AC050",
    make: "Honda",
    model: "CG 150",
    vehicleType: "MOTORCYCLE",
    region: "GBA",
    profile: "urbano",
  },
  {
    csvFile: "Historico-AC224UO-20260420-20260426.csv",
    plate: "AC224UO",
    name: "Moto AC224",
    make: "Yamaha",
    model: "YBR 125",
    vehicleType: "MOTORCYCLE",
    region: "GBA",
    profile: "urbano",
  },
  {
    csvFile: "Historico-AD919NK-20260420-20260426.csv",
    plate: "AD919NK",
    name: "Moto AD919",
    make: "Honda",
    model: "Wave 110",
    vehicleType: "MOTORCYCLE",
    region: "GBA",
    profile: "urbano",
  },
  {
    csvFile: "Historico-AJW565-20260420-20260426.csv",
    plate: "AJW565",
    name: "Moto AJW565",
    make: "Honda",
    model: "CG 150",
    vehicleType: "MOTORCYCLE",
    region: "GBA",
    profile: "urbano",
  },
  {
    csvFile: "Historico-ARM810-20260420-20260426.csv",
    plate: "ARM810",
    name: "Moto ARM810",
    make: "Yamaha",
    model: "YBR 125",
    vehicleType: "MOTORCYCLE",
    region: "GBA",
    profile: "urbano",
  },
  {
    csvFile: "Historico-NDD000-20260420-20260426.csv",
    plate: "NDD000",
    name: "Moto NDD000",
    make: "Honda",
    model: "Wave 110",
    vehicleType: "MOTORCYCLE",
    region: "GBA",
    profile: "urbano",
  },
  {
    csvFile: "Historico-AE755YR-20260420-20260426.csv",
    plate: "AE755YR",
    name: "Camión AE755",
    make: "Volvo",
    model: "FH 460",
    vehicleType: "TRUCK",
    region: "Cuyo",
    profile: "larga-distancia",
  },
  {
    csvFile: "Historico-AG603IB-20260420-20260426.csv",
    plate: "AG603IB",
    name: "Camión AG603",
    make: "Mercedes-Benz",
    model: "Atego 1726",
    vehicleType: "TRUCK",
    region: "Cuyo",
    profile: "larga-distancia",
  },
  {
    csvFile: "Historico-AB456RM-20260420-20260426.csv",
    plate: "AB456RM",
    name: "Camión AB456",
    make: "Mercedes-Benz",
    model: "Atego 1726",
    vehicleType: "TRUCK",
    region: "GBA",
    profile: "mixto",
  },
  {
    csvFile: "Historico-AC335ZJ-20260420-20260426.csv",
    plate: "AC335ZJ",
    name: "Camión AC335",
    make: "Iveco",
    model: "Daily 70C16",
    vehicleType: "TRUCK",
    region: "GBA",
    profile: "mixto",
  },
  {
    csvFile: "Historico-AE162KX-20260420-20260426.csv",
    plate: "AE162KX",
    name: "Camión AE162",
    make: "Scania",
    model: "G410",
    vehicleType: "TRUCK",
    region: "GBA",
    profile: "mixto",
  },
  {
    csvFile: "Historico-AF847TT-20260420-20260426.csv",
    plate: "AF847TT",
    name: "Camión AF847",
    make: "Volkswagen",
    model: "Delivery 11.180",
    vehicleType: "TRUCK",
    region: "GBA",
    profile: "mixto",
  },
  {
    csvFile: "Historico-AH650MQ-20260420-20260426.csv",
    plate: "AH650MQ",
    name: "Camión AH650",
    make: "Iveco",
    model: "Tector 170E22",
    vehicleType: "TRUCK",
    region: "GBA",
    profile: "mixto",
  },
  {
    csvFile: "Historico-PJC824-20260420-20260426.csv",
    plate: "PJC824",
    name: "Camión PJC824",
    make: "Iveco",
    model: "Daily 70C16",
    vehicleType: "TRUCK",
    region: "GBA",
    profile: "mixto",
  },
  {
    csvFile: "Historico-PQV913-20260420-20260426.csv",
    plate: "PQV913",
    name: "Camión PQV913",
    make: "Scania",
    model: "G410",
    vehicleType: "TRUCK",
    region: "GBA",
    profile: "mixto",
  },
  {
    csvFile: "Historico-AE262VU-20260420-20260426.csv",
    plate: "AE262VU",
    name: "Camión AE262",
    make: "Scania",
    model: "P310",
    vehicleType: "TRUCK",
    region: "NOA",
    profile: "larga-distancia",
  },
  {
    csvFile: "Historico-AC224UM-20260420-20260426.csv",
    plate: "AC224UM",
    name: "Camión AC224",
    make: "Iveco",
    model: "Tector 170E22",
    vehicleType: "TRUCK",
    region: "Pampa",
    profile: "mixto",
  },
  {
    csvFile: "Historico-AH460ZC-20260420-20260426.csv",
    plate: "AH460ZC",
    name: "Camión AH460",
    make: "Mercedes-Benz",
    model: "Accelo 1316",
    vehicleType: "TRUCK",
    region: "Pampa",
    profile: "mixto",
  },
  {
    csvFile: "Historico-AB735DB-20260420-20260426.csv",
    plate: "AB735DB",
    name: "Camión AB735",
    make: "Mercedes-Benz",
    model: "Accelo 1316",
    vehicleType: "TRUCK",
    region: "Patagonia",
    profile: "larga-distancia",
  },
  {
    csvFile: "Historico-AE782ON-20260420-20260426.csv",
    plate: "AE782ON",
    name: "Camión AE782",
    make: "Volvo",
    model: "VM 270",
    vehicleType: "TRUCK",
    region: "Patagonia",
    profile: "larga-distancia",
  },
  {
    csvFile: "Historico-AE878GJ-20260420-20260426.csv",
    plate: "AE878GJ",
    name: "Camión AE878",
    make: "Volkswagen",
    model: "Constellation 17.190",
    vehicleType: "TRUCK",
    region: "Patagonia",
    profile: "larga-distancia",
  },
  {
    csvFile: "Historico-AG222TX-20260420-20260426.csv",
    plate: "AG222TX",
    name: "Camión AG222",
    make: "Ford",
    model: "Cargo 1722",
    vehicleType: "TRUCK",
    region: "Patagonia",
    profile: "larga-distancia",
  },
];
