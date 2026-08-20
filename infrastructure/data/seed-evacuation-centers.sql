-- Teammate 4 (DevOps & Data) Skeleton: Evacuation Centers & High Ground Shelters
--
-- PURPOSE:
-- Seeds known public shelters (primary schools, churches, sub-county grounds)
-- in flood-prone wards around Lake Victoria Basin.

CREATE TABLE IF NOT EXISTS evacuation_centers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id text NOT NULL,
    name text NOT NULL,
    capacity_persons integer NOT NULL,
    elevation_meters numeric,
    contact_person text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed known emergency centers in Nyando & Kano Plains
INSERT INTO evacuation_centers (ward_id, name, capacity_persons, elevation_meters, contact_person)
VALUES
    ('KE-039-NYANDO', 'Ahero Primary School Multipurpose Hall', 1200, 1142.5, 'Sub-County Disaster Lead'),
    ('KE-039-NYANDO', 'Ombaka High Ground Rescue Centre', 850, 1148.0, 'Red Cross Nyando Liaison'),
    ('KE-039-BUDALANGI', 'Bunyala Cultural Hall & Relief Center', 1500, 1139.2, 'Busia County Disaster Desk'),
    ('KE-039-KANO', 'Kochogo Community Shelter', 600, 1144.0, 'Ward Administrator Kano')
ON CONFLICT DO NOTHING;

-- TODO (Teammate 4): Add 2 more high ground shelter records for 'KE-039-NZOIA' (e.g. Ruambwa Primary)
-- and 'KE-039-RACHUONYO' (e.g. Kendu Bay Relief Grounds).
