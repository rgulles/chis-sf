San Fernando boundary provenance
===============================

Asset: `san-fernando-pampanga-boundary.geojson` (one FeatureCollection feature).

Source: https://github.com/faeldon/philippines-json-maps
Pinned revision: `8eeead560246863c8c820c31ca6fbca81a279477`
Input: `2023/geojson/provdists/hires/municities-provdist-305400000.0.1.json`
Raw URL: https://raw.githubusercontent.com/faeldon/philippines-json-maps/8eeead560246863c8c820c31ca6fbca81a279477/2023/geojson/provdists/hires/municities-provdist-305400000.0.1.json
Retrieved: 2026-10-08. MIT license retained in `boundary-LICENSE.txt`.

The publisher derives these administrative maps from altcoder/philippines-psgc-shapefiles,
with PSA codes updated to 31 December 2023. This is an open administrative reference
dataset, not a cadastral survey or a direct export from the GeoRisk 2020 layer.
The high-resolution export is the publisher's 10% simplification; no further
simplification or hand-drawn geometry was applied here. Coordinates are longitude,
latitude in GeoJSON/WGS84 degrees.

Selection required all of:
- adm3_psgc = 305416000 (10-digit PSGC 0305416000)
- adm3_en = City of San Fernando
- adm2_psgc = 305400000 (Pampanga, 0305400000)
- adm1_psgc = 300000000 (Central Luzon, 0300000000)

Only that feature was retained, with its original properties and geometry. No
heritage records appear in this asset. Runtime downloads only the local city file.

The preferred GeoRisk PSA/Municipal_2020/MapServer/0 and PSA/Municipal/MapServer/0
returned ArcGIS error 404 (Service not found) on retrieval. A public Geodata Systems
ArcGIS alternative was inspected but not used because its license prohibits offline
export. The final asset comes exclusively from the MIT-licensed source above.
