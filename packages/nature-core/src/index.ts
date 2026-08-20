export interface NatureInput { riparianDeficit: number; wetlandLossProxy: number; upstreamContribution: number; }

/** Indicative prioritisation only; it does not model hydrology or promise flood reduction. */
export function nbsOpportunityScore(input: NatureInput): number {
  for (const value of Object.values(input)) if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError("Nature inputs must be normalised between 0 and 1.");
  return Math.round((input.riparianDeficit * 0.4 + input.wetlandLossProxy * 0.35 + input.upstreamContribution * 0.25) * 1000) / 10;
}