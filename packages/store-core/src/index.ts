export interface StoredRecord { id: string; createdAt: string; }

/** A deterministic repository boundary for the initial demo; replace with the PostGIS adapter without changing callers. */
export class InMemoryRepository<T extends StoredRecord> {
  readonly #records = new Map<string, T>();

  create(record: T): T {
    if (!record.id || !Number.isFinite(Date.parse(record.createdAt))) throw new Error("Records require an id and valid createdAt timestamp.");
    if (this.#records.has(record.id)) throw new Error(`Record ${record.id} already exists.`);
    this.#records.set(record.id, structuredClone(record));
    return structuredClone(record);
  }

  get(id: string): T | null {
    const record = this.#records.get(id);
    return record ? structuredClone(record) : null;
  }
}