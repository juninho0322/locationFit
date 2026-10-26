# Location Fit

A warehouse space planner with separate workflows for checking one SKU and planning a complete order. Built with React, TypeScript, Vite and React Three Fiber.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` produces the production app in `dist`, `npm run lint` checks the source, and `npm test` runs calculation regression tests.

## Workflow

1. **Location setup:** save a name and choose **Pick face**, **Pallet** or **Cage**, with usable width/depth/height. Pallets offer UK (120 × 100 cm), Euro (120 × 80 cm) or custom footprints. The selected type is labelled beside the form and in the live 3D preview, which follows unsaved edits. The presets are starting points; every dimension is editable. Pallet height means usable load height above the base.
2. **SKU setup:** save the SKU code, description, units per case and outer case dimensions. SKU codes must be unique (case-insensitive). Edit existing entries to update dimensions or pack sizes.
3. **Capacity check:** select a pick face, pallet or cage and either a saved SKU or quick case dimensions. See cases and contained units that fit in one location, the placement grid, utilization and an interactive 3D view.
4. **Order planner:** enter an order number, select a pallet or cage, and enter SKU, description, quantity and units/full boxes. Upload a CSV to replace the lines, or add lines manually. Choose automatic, grouped box sizes, column stacking, flexible stacking or **Keep SKUs separate**, then calculate. The selected method is saved with the order. Keep SKUs separate uses dedicated pallets/cages for each SKU. The result shows pallets/cages needed and a full-width 3D loading plan. Orders save automatically; previous orders are always visible in the searchable **Saved orders** list at the top of Order planner. Download a PDF with each pallet/cage’s contents, completed-load diagrams and numbered placement sheets.

All dimensions are entered and displayed in **centimetres**. Capacity checks and order plans are separate. Auditing is not shown in the workspace.

## Calculation rules

- Pick faces are single-SKU only. They are available in capacity checks and excluded from order planning, even for an order with just one SKU. Both the order calculation and underlying packing entry point reject pick-face locations.
- Mixed-SKU orders can use pallets or cages. New orders never inherit a pick face selected in the capacity check. Existing orders pointing to a pick face require the user to select a pallet or cage before calculation.

- Capacity checks compare all six case rotations and use the best uniform grid. This is a repeatable grid capacity, not a proof of globally optimal mixed-orientation packing.
- Units remain inside cases. A request for 13 units with 12 units per case needs two case footprints; one is marked partial. Loose-unit packing would require unit dimensions, which this model does not contain.
- Repeated lines for the same SKU are combined before rounding to cases. Full-case quantities are converted to units using that SKU's units-per-case value.
- The mixed-order planner uses the existing 3D engine, including rotations, overlap and boundary checks, stacking support, and consolidation. Automatic mode compares grouping by case size, columns and flexible placement, prioritizing fewer locations and then packing density. Explicit column and box-size methods retain their structure. Flexible placement can consolidate layouts produced by all three methods. Keep SKUs separate optimises each SKU independently and never consolidates across products. This is the best of the tested methods, not a guarantee of the global optimum.
- A case that cannot fit in any orientation is explicitly flagged. Counts in an incomplete plan cover only the fitting SKUs.
- Estimates do not model weight, fragility, orientation restrictions, aisle clearance or load-bearing limits. Set usable dimensions accordingly and validate operational stacking constraints.
- Packing runs in a cancellable Web Worker. The interactive planner supports up to 2,000 cases per order. Capacity calculations retain the full count but render at most 1,500 cases in the single-location preview.

## CSV upload

Download the template in Order planner, or use this layout:

```csv
SKU,Description,Units,Boxes
SKU-001,Hand towels,25,
SKU-002,Storage bags,,4
```

Fill in units or boxes. If both contain positive quantities, both are included as separate lines and combined for packing. `SKU,Description,Quantity,Type` is also supported (`Type` is `units` or `boxes`). Headers are case-insensitive; quoted descriptions, escaped quotes, multiline fields, UTF-8 BOM and semicolon-delimited files are supported.

SKUs must already have dimensions and units per case in SKU setup. Descriptions from the CSV apply to the order line without overwriting the SKU library. Invalid rows or unknown SKUs reject the entire file and leave the order unchanged. A successful upload replaces the lines and offers **Undo import** until the lines are edited. Limits: 2 MB and 5,000 input rows; the existing 2,000-case planning limit still applies.

## 3D views

Both viewports fill a panel with a definite height. The camera fits the selected volume using the actual canvas aspect ratio, and the orbit target uses the same centre. Switching locations, switching individual/all pallets, resizing, or pressing **Fit view** reframes the load. Multiple pallets are arranged around the scene centre; placement details sit below the canvas.

Pallets have a wooden 3D base with deck boards, support blocks and runners. Cages have a steel deck, four caster wheels and mesh sides. These illustrations appear in setup, capacity checks and order plans; their bases sit below the usable volume and are included in the camera fit without changing packing dimensions. Incomplete location drafts use an example size until dimensions are entered.

## Downloadable loading plans

**Download plan (PDF)** creates an order overview, numbered pallet/cage contents lists (full boxes, partial boxes and actual units), completed-load top/front diagrams and placement sheets. Each sheet identifies the pallet, starting height and numbered steps. Positions are measured from the front-left corner above the deck; oriented width/depth/height tell the operator how to turn each case. Stages are ordered from the lowest base upwards so supporting boxes are placed first. They need not be uniform layers when case heights differ.

The diagrams are printable vectors generated from the same box coordinates as the 3D view. Colours distinguish SKUs; numbered labels link diagrams to placement rows, and `P` marks partial boxes. Oversized SKUs are listed as an incomplete order. `node scripts/preview-plan-pdf.mjs` generates a demonstration PDF under `output/pdf/` for visual verification.

## Saved data

Locations, SKUs, order lines, stacking choices, calculated plans, active order and current workspace tab are saved automatically in browser local storage. Open **Order planner → Saved orders**, search by order number and click **Open order** to revisit an order. New orders keep earlier records. Orders show their last updated time and the most recent edits appear first.

Reopening an unchanged order restores its calculated 3D plan and PDF download. Changes to the order, its location or relevant SKU data require recalculation; unrelated SKU changes do not invalidate its layout. Existing orders without a saved calculation remain available and can be calculated normally.

The save-status banner confirms successful writes and reports blocked or full storage with a retry action. Unreadable saved records are left untouched rather than overwritten with defaults. Local data belongs to the same browser profile and site address; clearing site data removes it, and private-browsing storage may disappear when that session closes.

Existing locations are retained. Recognisable legacy pallet and cage types keep their classification; unclassified custom volumes default to single-SKU pick-face behaviour until explicitly reclassified in Location setup. Names and dimensions are preserved. On the first run of the new workspace, valid legacy pack rows are converted from metres to centimetres and their former one-character SKU prefix is removed, following the old matching convention. Legacy order lines are grouped by order name and imported as units. Unmatched SKUs remain unresolved order lines and must be corrected before calculation. The original spreadsheet storage keys remain untouched. Review migrated SKU data before planning.

## Verification

Location-rule tests cover pick-face rejection (including saved orders and direct engine calls), mixed-SKU pallets/cages, safe legacy classification, default order selection, and the rendered dropdown options for both workflows. Form inputs and selects share a 44 px height, common line height and padding; the order header uses a grid to align labels, fields and actions.

The test suite covers rotations, decimal boundaries, units/case conversion, repeated SKU aggregation, multi-location orders, oversized cases, validation, all three packing methods, and automatic selection. CSV tests cover parsing, validation, template round-tripping and quantities. Camera tests project volume corners into narrow and wide viewports to verify centring and fit. Mixed-order tests check that every packed case stays in bounds, does not overlap another case, and is counted in the volume and quantity totals.

## Code maintenance

Run `npm run check` for lint, the strict TypeScript/production build and the full regression suite. TypeScript rejects unused locals and parameters. `npm audit` checks the installed dependency versions against published advisories.

Shared packing contracts live in `src/types/packing.ts`; UI state and worker lifecycle are separated through `useOrderCalculation`. The saved order is the source of truth for a calculated plan. Worker messages use a shared typed protocol, and cancelled or outdated jobs cannot replace newer order inputs. Explicit box-size and column methods skip unrelated packing searches.

Browser records are validated at the storage boundary, including nested order lines and saved layouts. Invalid records remain untouched. The legacy spreadsheet data adapter and migration remain supported; the unused spreadsheet/audit screens and spreadsheet UI dependency have been removed.
