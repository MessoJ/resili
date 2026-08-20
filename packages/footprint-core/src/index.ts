export interface ComputeFootprintInput { inferenceCount: number; wattHoursPerInference: number; gridGramsCo2ePerKwh: number; }

export function estimateComputeFootprint(input: ComputeFootprintInput): { wattHours: number; gramsCo2e: number } {
  for (const value of Object.values(input)) if (!Number.isFinite(value) || value < 0) throw new RangeError("Footprint inputs must be finite non-negative values.");
  const wattHours = input.inferenceCount * input.wattHoursPerInference;
  return { wattHours, gramsCo2e: Math.round((wattHours / 1000) * input.gridGramsCo2ePerKwh * 1000) / 1000 };
}