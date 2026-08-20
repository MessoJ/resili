import { toRiskGeoJson, type PublicRiskRecord } from "@rezili/api-contract";
import { InMemoryRepository } from "@rezili/store-core";

export class RiskReadApi {
  readonly #risks = new InMemoryRepository<PublicRiskRecord & { id: string; createdAt: string }>();

  publish(record: PublicRiskRecord): void {
    this.#risks.create({ ...record, id: record.inputsHash, createdAt: record.assessedAt });
  }

  publicRiskGeoJson(inputsHash: string) {
    const record = this.#risks.get(inputsHash);
    return toRiskGeoJson(record ? [record] : []);
  }
}