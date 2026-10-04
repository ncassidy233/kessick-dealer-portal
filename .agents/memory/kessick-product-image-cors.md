---
name: Kessick product imagery
description: Rules for using official catalog photography and dimensionally accurate room-placement graphics.
---

Official Kessick catalog photography is suitable for product cards and reference views, not as a room-placement overlay. Product placement must use a clean elevation or approved cutout based on verified physical dimensions. Catalog image responses also do not consistently include browser CORS headers, so any image used in canvas-backed rendering or export needs same-origin delivery. Photo-derived GLB/AR assets are visual references only, even when scaled from verified overall dimensions; they are not approved CAD or fabrication geometry.

**Why:** Lifestyle photos include surrounding rooms and cannot be stretched to a product's width and height without creating a visibly false AR result. Cross-origin images can also fail or taint the canvas.

**How to apply:** Keep lifestyle photography in catalog/reference UI. Render placements from verified dimensions with procedural elevations or approved transparent cutouts. Keep canvas image paths local and separate from source provenance; never invent product imagery. Mark generated 3D/AR files as unverified and exclude them from fabrication until approved CAD replaces them.