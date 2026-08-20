-- Seed data: Ward boundaries and profiles for Lake Victoria Basin demo
--
-- Geometry is simplified GeoJSON centroids. Full ward polygons would come
-- from HDX COD-AB (Kenya administrative boundaries) in production.
-- Coordinates are approximate ward centroids for demo purposes.

INSERT INTO wards (ward_id, name, county, sub_county, population, area_sq_km, flood_plain_fraction, historical_flood_frequency, geometry)
VALUES
    ('KE-039-NYANDO', 'Nyando', 'Kisumu', 'Nyando', 45000, 125.0, 0.72, 0.85,
     ST_GeogFromText('SRID=4326;MULTIPOLYGON(((34.87 -0.22, 34.97 -0.22, 34.97 -0.12, 34.87 -0.12, 34.87 -0.22)))')),

    ('KE-039-BUDALANGI', 'Budalangi', 'Busia', 'Budalangi', 62000, 180.0, 0.88, 0.92,
     ST_GeogFromText('SRID=4326;MULTIPOLYGON(((34.03 0.07, 34.13 0.07, 34.13 0.17, 34.03 0.17, 34.03 0.07)))')),

    ('KE-039-KANO', 'Kano Plains', 'Kisumu', 'Nyando', 38000, 95.0, 0.60, 0.70,
     ST_GeogFromText('SRID=4326;MULTIPOLYGON(((34.80 -0.15, 34.90 -0.15, 34.90 -0.05, 34.80 -0.05, 34.80 -0.15)))')),

    ('KE-039-RACHUONYO', 'Rachuonyo East', 'Homa Bay', 'Rachuonyo East', 28000, 110.0, 0.35, 0.30,
     ST_GeogFromText('SRID=4326;MULTIPOLYGON(((34.70 -0.43, 34.80 -0.43, 34.80 -0.33, 34.70 -0.33, 34.70 -0.43)))')),

    ('KE-039-NZOIA', 'Nzoia Mouth', 'Busia', 'Bunyala', 32000, 85.0, 0.80, 0.88,
     ST_GeogFromText('SRID=4326;MULTIPOLYGON(((33.97 0.03, 34.07 0.03, 34.07 0.13, 33.97 0.13, 33.97 0.03)))'))

ON CONFLICT (ward_id) DO NOTHING;

-- Seed deterministic hazard observations for demo
INSERT INTO hazard_observations (ward_id, observed_at, source, model_version, precipitation_3day_mm, precipitation_5day_mm, discharge_ratio, discharge_trend, rainfall_anomaly, antecedent_moisture, inputs_hash)
VALUES
    ('KE-039-NYANDO', '2026-08-20T12:00:00Z', 'deterministic-demo-fixture', 'risk-ml-v0.1.0', 156.3, 245.8, 1.89, 12.5, 1.85, 0.78, 'demo-nyando-001'),
    ('KE-039-BUDALANGI', '2026-08-20T12:00:00Z', 'deterministic-demo-fixture', 'risk-ml-v0.1.0', 178.2, 280.1, 2.15, 18.3, 2.10, 0.85, 'demo-budalangi-001'),
    ('KE-039-KANO', '2026-08-20T12:00:00Z', 'deterministic-demo-fixture', 'risk-ml-v0.1.0', 95.0, 155.2, 1.25, 6.8, 1.35, 0.55, 'demo-kano-001'),
    ('KE-039-RACHUONYO', '2026-08-20T12:00:00Z', 'deterministic-demo-fixture', 'risk-ml-v0.1.0', 42.5, 68.3, 0.65, -2.1, 0.75, 0.30, 'demo-rachuonyo-001'),
    ('KE-039-NZOIA', '2026-08-20T12:00:00Z', 'deterministic-demo-fixture', 'risk-ml-v0.1.0', 165.8, 260.5, 2.05, 15.7, 1.95, 0.82, 'demo-nzoia-001')
ON CONFLICT (inputs_hash) DO NOTHING;
