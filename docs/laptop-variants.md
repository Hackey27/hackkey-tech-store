# Laptop CPU / RAM / Storage variants

`laptops/{laptopId}` optionally stores `variantsEnabled` and `variantConfig`.
Absent or false means the existing single specs and price are used, without a bulk migration. Switching off retains all variant data and single-price inputs. Save a product through Category setup to enable variants. Historical orders are never rewritten.

The configuration contains `cpus: [{id, prefix, model}]`, `ram` and `storage: [{id, value}]`, and manually added `rows: [{id, cpuId, ramId, storageId, priceGhs?, priceRmb?}]`. UUIDs are allocated once on creation and retained on edits. Removing a referenced value asks for confirmation and removes its rows. Never reuse a deleted row ID for a different combination.

Each row becomes an independent catalogue item with an internal `baseId::rowId` ID and a public `/laptops/{baseId}?variant={rowId}` URL. Property IDs and public labels/prices support the selectors; private variant source prices and shared shipping inputs are stripped from catalogue responses.

Available rows use their GHS price directly, bypassing global price adjustments and the RMB engine. Preorder rows substitute their RMB source cost into the existing shared pricing engine with the laptop’s common shipping costs and delivery options. Both currencies remain stored separately. Global changes refresh the calculated catalogue prices; checkout independently verifies the current price against the customer’s selected price and rejects stale, deleted or unavailable combinations.

Selectors refine CPU → RAM → Storage. Changing CPU keeps compatible RAM/Storage where possible and selects a priced row for that CPU; RAM similarly selects a compatible storage row. Choices without a priced row for the current upstream selection and delivery remain visible but disabled. Selection replaces the URL without creating additional history entries.

Cart lines hold the public variant selection, selected delivery and final integer-pesewa price. Checkout sends base/row/delivery identifiers and the displayed expected price. The authoritative order snapshots row ID, CPU/RAM/Storage labels, GHS/RMB basis, selected delivery and unit price; existing order totals and snapshots remain fixed after product or exchange-rate changes.

Laptop delivery labels continue to be 2–3 weeks / 6–8 weeks. There was no 6–8 months label in the existing laptop implementation.
