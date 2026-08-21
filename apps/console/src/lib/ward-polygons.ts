// Approximate ward polygon boundaries for the Lake Victoria Basin demo wards.
//
// The upstream ML/gateway API only ships ward centroids (see
// SECURITY.md — public report locations are generalised to ward level and
// exact administrative boundaries are not published for household-level
// privacy). To let the Console render wards as *areas* on the basemap
// (instead of only point markers), we ship a compact set of hand-authored
// polygons that approximate each ward's real-world footprint along the
// Winam Gulf / Nzoia floodplain.
//
// These are illustrative, ward-level generalisations — NOT survey-grade
// boundaries. They must never be used for cadastral, legal, or evacuation
// routing purposes. The map legend attributes them accordingly.
//
// Coordinates are [longitude, latitude] pairs, polygon rings closed
// (first === last point), following the GeoJSON RFC 7946 convention.

export type WardPolygon = {
  ward_id: string;
  name: string;
  polygon: [number, number][];
};

export const WARD_POLYGONS: WardPolygon[] = [
  {
    // Nyando: floodplain south-east of Kisumu, straddles the Nyando river
    // as it meets the Winam Gulf. Elongated west-to-east.
    ward_id: "KE-039-NYANDO",
    name: "Nyando",
    polygon: [
      [34.820, -0.135],
      [34.905, -0.120],
      [35.005, -0.140],
      [35.030, -0.185],
      [35.000, -0.235],
      [34.925, -0.240],
      [34.850, -0.220],
      [34.805, -0.180],
      [34.820, -0.135],
    ],
  },
  {
    // Kano Plains: irrigated rice/sugar belt north of Nyando, west of the
    // Nandi escarpment. Broadly rectangular, tilted NW-SE.
    ward_id: "KE-039-KANO",
    name: "Kano Plains",
    polygon: [
      [34.780, -0.055],
      [34.870, -0.045],
      [34.940, -0.070],
      [34.955, -0.115],
      [34.895, -0.145],
      [34.815, -0.140],
      [34.770, -0.110],
      [34.760, -0.075],
      [34.780, -0.055],
    ],
  },
  {
    // Rachuonyo: south shore of the Winam Gulf, hills sloping to the lake.
    ward_id: "KE-039-RACHUONYO",
    name: "Rachuonyo",
    polygon: [
      [34.680, -0.335],
      [34.770, -0.325],
      [34.830, -0.355],
      [34.845, -0.410],
      [34.795, -0.445],
      [34.720, -0.440],
      [34.665, -0.410],
      [34.655, -0.370],
      [34.680, -0.335],
    ],
  },
  {
    // Budalangi: lower Nzoia delta on the Ugandan border, low-lying and
    // repeatedly flooded. Follows the river mouth wedge.
    ward_id: "KE-039-BUDALANGI",
    name: "Budalangi",
    polygon: [
      [34.020, 0.155],
      [34.095, 0.170],
      [34.160, 0.140],
      [34.180, 0.095],
      [34.145, 0.060],
      [34.080, 0.070],
      [34.030, 0.100],
      [34.010, 0.130],
      [34.020, 0.155],
    ],
  },
  {
    // Nzoia (middle-lower reach): upstream of Budalangi along the Nzoia
    // river channel. Elongated along the river.
    ward_id: "KE-039-NZOIA",
    name: "Nzoia",
    polygon: [
      [33.955, 0.115],
      [34.030, 0.130],
      [34.085, 0.105],
      [34.100, 0.060],
      [34.070, 0.020],
      [34.005, 0.020],
      [33.960, 0.055],
      [33.945, 0.090],
      [33.955, 0.115],
    ],
  },
];

export const WARD_POLYGON_BY_ID: Record<string, WardPolygon> = Object.fromEntries(
  WARD_POLYGONS.map((w) => [w.ward_id, w])
);
