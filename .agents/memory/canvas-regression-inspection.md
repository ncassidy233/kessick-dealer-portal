---
name: Canvas regression inspection
description: How to make Kessick canvas regression checks fail when the visible Konva scene is wrong.
---

Canvas placement regressions must inspect the live Konva scene graph for rendered node types, transformed bounds, labels, and controls. Do not assert independently calculated geometry or hardcoded diagnostic claims.

**Why:** Mirrored calculations can stay correct while the actual frame is stretched, replaced with an image, or missing its selection UI, producing a false pass for the exact visual regression under test.

**How to apply:** Keep any browser inspection hook development-only and derive its output by traversing current Konva nodes at assertion time. Compare actual rendered bounds with verified catalog dimensions and check actual descendants and visibility.