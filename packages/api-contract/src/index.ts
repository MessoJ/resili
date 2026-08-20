export interface PublicRiskRecord { wardId: string; assessedAt: string; score: number; band: "low" | "moderate" | "high" | "severe"; modelVersion: string; inputsHash: string; }

export function toRiskGeoJson(records: readonly PublicRiskRecord[]): { type: "FeatureCollection"; features: readonly { type: "Feature"; properties: PublicRiskRecord; geometry: null }[] } {
  return { type: "FeatureCollection", features: records.map((properties) => ({ type: "Feature", properties, geometry: null })) };
}