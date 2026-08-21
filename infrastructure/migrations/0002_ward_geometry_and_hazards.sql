-- Migration 0002: Ward geometry, hazard observations, alert log, payout audit
--
-- Adds the full schema needed for the resili climate risk platform.
-- Designed for PostGIS with spatial indexing on ward geometries.

-- Wards table with PostGIS geometry
CREATE TABLE IF NOT EXISTS wards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id text NOT NULL UNIQUE,
    name text NOT NULL,
    county text NOT NULL,
    sub_county text,
    geometry geography(MultiPolygon, 4326),
    population integer,
    area_sq_km numeric,
    flood_plain_fraction numeric CHECK (flood_plain_fraction BETWEEN 0 AND 1),
    historical_flood_frequency numeric CHECK (historical_flood_frequency BETWEEN 0 AND 1),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_wards_geometry ON wards USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_wards_county ON wards (county);

-- Hazard observations (time-series from forecast ingest)
CREATE TABLE IF NOT EXISTS hazard_observations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id text NOT NULL REFERENCES wards(ward_id),
    observed_at timestamptz NOT NULL,
    source text NOT NULL,
    model_version text NOT NULL,
    precipitation_3day_mm numeric,
    precipitation_5day_mm numeric,
    discharge_ratio numeric,
    discharge_trend numeric,
    rainfall_anomaly numeric,
    antecedent_moisture numeric,
    inputs_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_hazard_ward_time ON hazard_observations (ward_id, observed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hazard_inputs_hash ON hazard_observations (inputs_hash) WHERE deleted_at IS NULL;

-- Expand ward_risk_scores with foreign key
ALTER TABLE ward_risk_scores
    ADD COLUMN IF NOT EXISTS band text,
    ADD COLUMN IF NOT EXISTS explanation jsonb,
    ADD COLUMN IF NOT EXISTS source text,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Alert log
CREATE TABLE IF NOT EXISTS alert_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_identifier text NOT NULL UNIQUE,
    ward_id text NOT NULL,
    risk_score numeric NOT NULL,
    band text NOT NULL,
    cap_xml text,
    sent_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    delivery_channel text NOT NULL DEFAULT 'sms',
    delivery_status text NOT NULL DEFAULT 'pending',
    source text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CHECK (expires_at > sent_at)
);

CREATE INDEX IF NOT EXISTS idx_alert_ward ON alert_log (ward_id, sent_at DESC);

-- Payout audit
CREATE TABLE IF NOT EXISTS payout_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key text NOT NULL UNIQUE,
    trigger_id text NOT NULL,
    ward_id text NOT NULL,
    recipient_reference text NOT NULL,
    amount_kes integer NOT NULL CHECK (amount_kes > 0),
    status text NOT NULL DEFAULT 'pending',
    approver_1 text NOT NULL,
    approver_2 text NOT NULL,
    decision_hash text NOT NULL,
    payment_provider text NOT NULL DEFAULT 'mock',
    payment_reference text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CHECK (approver_1 != approver_2)
);

-- Community incident reports (ward-level generalisation, no PII)
CREATE TABLE IF NOT EXISTS incident_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id text NOT NULL,
    incident_type text NOT NULL,
    reported_at timestamptz NOT NULL DEFAULT now(),
    source_channel text NOT NULL DEFAULT 'ussd',
    verified boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
