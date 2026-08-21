-- Evacuation Centers & High Ground Shelters
--
-- PURPOSE:
-- Seeds known public shelters (primary schools, churches, sub-county grounds)
-- on high ground in flood-prone wards around the Lake Victoria Basin. Used by
-- the Console and USSD flows to direct residents to the nearest safe shelter.
--
-- Locations are generalised to ward-level centroids (climate-safety guideline:
-- public shelter points are not exposed at building precision). Coordinates are
-- approximate and for demo purposes; production would source these from the
-- county disaster management registries.

CREATE TABLE IF NOT EXISTS evacuation_centers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id text NOT NULL REFERENCES wards(ward_id),
    name text NOT NULL,
    capacity_persons integer NOT NULL CHECK (capacity_persons > 0),
    elevation_meters numeric,
    location geography(Point, 4326),
    contact_person text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE (ward_id, name)
);

CREATE INDEX IF NOT EXISTS idx_evac_ward ON evacuation_centers (ward_id);
CREATE INDEX IF NOT EXISTS idx_evac_location ON evacuation_centers USING GIST (location);

-- Seed known emergency centers on high ground across the demo wards.
INSERT INTO evacuation_centers (ward_id, name, capacity_persons, elevation_meters, location, contact_person)
VALUES
    ('KE-039-NYANDO', 'Ahero Primary School Multipurpose Hall', 1200, 1142.5,
     ST_GeogFromText('SRID=4326;POINT(34.92 -0.17)'), 'Sub-County Disaster Lead'),
    ('KE-039-NYANDO', 'Ombaka High Ground Rescue Centre', 850, 1148.0,
     ST_GeogFromText('SRID=4326;POINT(34.90 -0.15)'), 'Red Cross Nyando Liaison'),
    ('KE-039-BUDALANGI', 'Bunyala Cultural Hall & Relief Center', 1500, 1139.2,
     ST_GeogFromText('SRID=4326;POINT(34.08 0.12)'), 'Busia County Disaster Desk'),
    ('KE-039-KANO', 'Kochogo Community Shelter', 600, 1144.0,
     ST_GeogFromText('SRID=4326;POINT(34.85 -0.10)'), 'Ward Administrator Kano'),
    ('KE-039-NZOIA', 'Ruambwa Multipurpose Shelter', 900, 1145.0,
     ST_GeogFromText('SRID=4326;POINT(34.02 0.08)'), 'Bunyala Sub-County Disaster Desk'),
    ('KE-039-RACHUONYO', 'Kendu Bay Relief Grounds', 750, 1152.0,
     ST_GeogFromText('SRID=4326;POINT(34.75 -0.38)'), 'Rachuonyo East Ward Administrator')
ON CONFLICT (ward_id, name) DO NOTHING;
