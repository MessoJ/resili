export interface DeliveryMetric { wardId: string; population: number; delivered: number; failed: number; }

export function sendaiTargetG(metrics: readonly DeliveryMetric[]): { code: "Sendai-G"; reached: number; population: number; proportion: number } {
  const population = metrics.reduce((total, metric) => total + metric.population, 0);
  const reached = metrics.reduce((total, metric) => total + metric.delivered, 0);
  if (population <= 0) throw new RangeError("Population must be positive for indicator reporting.");
  return { code: "Sendai-G", reached, population, proportion: Math.round((reached / population) * 10000) / 10000 };
}