-- 062_populate_spatial_ref_sys_4326.sql
-- Created: 2026-03-20
--
-- Fixes: "Cannot find SRID (4326) in spatial_ref_sys" definitively.
--
-- Root cause confirmed via diagnostic queries:
--   public.spatial_ref_sys has 0 rows — PostGIS was installed but its
--   coordinate reference system data was never populated. The geography
--   type cast (::geography) works as a pure type operation without needing
--   spatial_ref_sys, but ST_DWithin / ST_Distance on geography columns
--   need to look up the WGS84 spheroid parameters (semi-major axis,
--   inverse flattening) from spatial_ref_sys to compute geodesic distances.
--   That lookup returns 0 rows → error.
--
-- Fix: Insert the SRID 4326 (WGS84) row. ON CONFLICT DO NOTHING is safe to
-- re-run. All PostGIS geography operations in this project use SRID 4326.

INSERT INTO public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text)
VALUES (
  4326,
  'EPSG',
  4326,
  'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]',
  '+proj=longlat +datum=WGS84 +no_defs '
)
ON CONFLICT (srid) DO NOTHING;

-- Verify
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.spatial_ref_sys WHERE srid = 4326) THEN
    RAISE EXCEPTION 'SRID 4326 was not inserted — check permissions on spatial_ref_sys';
  ELSE
    RAISE NOTICE '✓ SRID 4326 (WGS84) is present in spatial_ref_sys';
  END IF;
END;
$$;
