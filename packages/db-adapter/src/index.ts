export interface SqlMigration { id: string; sql: string; }

export const initialMigrations: readonly SqlMigration[] = [{
  id: "0001_risk_and_trigger_audit",
  sql: `CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE IF NOT EXISTS ward_risk_scores (id uuid PRIMARY KEY, ward_id text NOT NULL, assessed_at timestamptz NOT NULL, score numeric NOT NULL CHECK (score BETWEEN 0 AND 100), model_version text NOT NULL, inputs_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS trigger_audit_events (id uuid PRIMARY KEY, trigger_id text NOT NULL, event_hash text NOT NULL UNIQUE, previous_hash text, occurred_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`
}];