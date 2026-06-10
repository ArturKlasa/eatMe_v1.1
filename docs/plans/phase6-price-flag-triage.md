# Phase 6 — price-discrepancy triage checklist

> Generated read-only by `infra/scripts/generate-phase6-flag-checklist.ts` from the migration 158 footer + live prod.

## What this is

Migration 158 collapsed single-child parent dishes into plain dishes and **kept the parent’s menu price**. In these 51 cases the (now-deleted) size/variant row carried a price >25% different from what was kept. For each, open the dish in the portal and decide:

1. **Dropped a real second size/portion** (e.g. *Grande*, *Corte grueso*, *100 gr.*, *Orden de tres*) — the dominant case. Collapsing kept one size and discarded the other. If the restaurant still sells both, **re-add the dropped size as an option** (not just edit the single price).
2. **Kept price is simply wrong** — fix it in place.
3. **Negative Δ = add-on delta** (e.g. "+ pechuga de pollo") that was never a standalone price — usually the kept price is already correct; no action.

**51 flags** — 51 matched to a dish, 0 ambiguous (multiple dishes, same name+price), 0 not found (price already changed since the migration).

Columns: **Δ** = variant vs. kept price. Tick **Done** as you clear each.

### Aura Campos Eliseos

| Done | Dish | Kept price | Dropped variant | Variant price | Δ | Dish ID |
|:--:|---|--:|---|--:|--:|---|
| [ ] | ENSALADA CESAR | $240 | + pechuga de pollo 120 g | $50 | -79% | `8c2fc014-3de7-4d6d-bec1-33468a2f7ff8` |

### Casi Esquina Pizza Bar

| Done | Dish | Kept price | Dropped variant | Variant price | Δ | Dish ID |
|:--:|---|--:|---|--:|--:|---|
| [ ] | AZTECA | $225 | Grande | $285 | +27% | `dc8e5d62-a360-45a5-852a-788d315de396` |
| [ ] | DEL MUERTO | $225 | Grande | $285 | +27% | `69b82009-b321-40c9-ab76-926ef7326ecf` |
| [ ] | DI PERA E GORGONZOLA | $225 | Grande | $285 | +27% | `37d66baf-305a-4126-9df3-f4462efa0c58` |
| [ ] | DONATELLO | $225 | Grande | $285 | +27% | `af1541f2-5351-4077-8284-24d413163c52` |
| [ ] | ELBA ESTHER | $225 | Grande | $285 | +27% | `fd7a9c51-a87d-4cc1-a1ef-0961b971db87` |
| [ ] | ENSALADA CÉSAR | $115 | Con pollo | $205 | +78% | `7374d796-2c87-438b-98f3-ee2e9c7c43fa` |
| [ ] | ENSALADA QUASI | $125 | Grande | $165 | +32% | `50622b8c-7b84-4e54-8c68-f0e694b8564a` |
| [ ] | Fetuccini Alfredo | $195 | Con pechuga de pollo (160g) | $255 | +31% | `4e639375-d098-4f28-bbc0-152344574981` |
| [ ] | FETUCCINI NAPOLITANA | $175 | Con pechuga de pollo (160g) | $235 | +34% | `fef50eef-78e1-45a7-97c9-1bc0043fb710` |
| [ ] | FUSILLI AL PESTO | $195 | Con pechuga de pollo (160g) | $255 | +31% | `b3b3d5a7-54a6-4730-b35d-7432e55ad781` |
| [ ] | Fusilli Arrabiata | $175 | Con pechuga de pollo (160g) | $235 | +34% | `66944426-6e93-45d9-a35c-96cc32f09a88` |
| [ ] | LYN MAY | $225 | Grande | $285 | +27% | `b5bb2e89-f349-46e8-bca3-75054f725a87` |
| [ ] | MARGHERITA | $225 | Grande | $285 | +27% | `cc870f36-856b-45c2-85f4-f3ee74c35fdb` |
| [ ] | NOA NOA | $225 | Grande | $285 | +27% | `0c3f3756-da8c-4368-83a4-8a75498da1a6` |
| [ ] | PEPPERONI | $225 | Grande | $285 | +27% | `4d1cd869-efde-4e3a-9d8e-0238ee7994b5` |
| [ ] | PIRI | $225 | Grande | $285 | +27% | `17c55db6-ecca-4fc9-8497-b0cf0655d7cd` |
| [ ] | PIZZA AL PASTOR | $225 | Grande | $284.99 | +27% | `7fb302af-f643-4c22-8523-9b8310b15681` |
| [ ] | POPEYE | $225 | Grande | $285 | +27% | `53b557e9-964b-430d-a346-1c83a4e84b81` |
| [ ] | PROSCIUTTO E FUNGHI | $225 | Grande | $285 | +27% | `89b7fb94-375d-4557-93c4-c4ea9bbe60e8` |
| [ ] | QUATTRO FORMAGGI | $225 | Grande | $285 | +27% | `2343a21c-7e32-4c58-ad47-e1ff263b7718` |
| [ ] | SALAME | $225 | Grande | $285 | +27% | `d1299355-0490-4da0-9232-518aae22d556` |
| [ ] | Sopes de Cochinita | $35 | Orden de tres. | $95 | +171% | `d11f444a-effd-4830-bb81-6b176f23da65` |
| [ ] | Spaghetti Aglio Olio | $175 | Con pechuga de pollo (160g) | $235 | +34% | `7f039c9f-eb88-47dd-9eeb-d676779f4db7` |
| [ ] | SPAGHETTI AL BURRO | $175 | Con pechuga de pollo (160g) | $235 | +34% | `a0d0585b-5231-4706-b869-b8795d0e0edd` |
| [ ] | Tacos de Cochinita | $35 | Orden de tres | $75 | +114% | `d884fa40-3d20-4b46-92e2-d5ff7c75e66e` |
| [ ] | TRAVIESA | $225 | Grande | $285 | +27% | `f7495ea1-9bc7-4f33-8c38-c92502a84f61` |
| [ ] | VEGETARIANA | $225 | Grande | $285 | +27% | `bfb21704-88ff-41ef-a1f1-32b78ac2f554` |

### Restaurante Catorze

| Done | Dish | Kept price | Dropped variant | Variant price | Δ | Dish ID |
|:--:|---|--:|---|--:|--:|---|
| [ ] | Boquerones en vinagre ajo y perejil | $190 | 10 uds | $330 | +74% | `11f980c5-eff4-4676-9c34-7bf5d66e4a4b` |
| [ ] | Chorizo ibérico de bellota | $195 | 100 gr. | $295 | +51% | `b8b9aa32-a224-47fc-bb45-47351e5f2e3e` |
| [ ] | Croquetas de jamón serrano | $160 | 8 pz | $290 | +81% | `101229f5-110c-428b-ab42-9c8873655114` |
| [ ] | Cubo de helado de pistache salado con toppings | $380 | GRANDE (4 personas) | $760 | +100% | `4af8eb40-b742-40c6-845a-7e7842e2b225` |
| [ ] | Ensalada de tomate orgánico con ventresca de bonito | $450 | Querido Vegano: Pídela sin ventresca | $190 | -58% | `d589e9e5-06ad-4ac1-87a4-006049517204` |
| [ ] | Ensaladilla rusa clásica con camarones y atún | $190 | 1 rac | $350 | +84% | `96462e39-6319-4ebb-9715-1cd6d5c35e99` |
| [ ] | Flores de calabaza en tempura rellenas de queso trufado | $160 | 1 rac | $290 | +81% | `d031c583-0414-45b8-92dc-227b57b37b5d` |
| [ ] | Jamón ibérico de bellota 50% | $350 | 100 gr. | $690 | +97% | `8c2188ac-a0e9-428f-9974-b7811274a9d4` |
| [ ] | Queso manchego curado reserva 6 meses | $295 | 100 gr. | $440 | +49% | `e17253db-6b74-43c4-810e-b53f33d68044` |
| [ ] | Salchichón ibérico de bellota | $195 | 100 gr. | $295 | +51% | `87fa9771-a15f-4000-8109-354b6c89e13e` |
| [ ] | Tacos de lechón, piña y chipotle | $160 | 4 pz | $260 | +63% | `fe0a92fe-37fd-4b24-9dbe-ef34e044798e` |

### SUMO Buffet Zona Rosa

| Done | Dish | Kept price | Dropped variant | Variant price | Δ | Dish ID |
|:--:|---|--:|---|--:|--:|---|
| [ ] | ALITAS | $189 | 25 piezas incluye 2 aderezos 3 salsas a elegir | $369 | +95% | `b16c7933-f607-4881-896c-f4d3701f817c` |

### Sushi Roll

| Done | Dish | Kept price | Dropped variant | Variant price | Δ | Dish ID |
|:--:|---|--:|---|--:|--:|---|
| [ ] | Atún | $179 | Corte grueso | $261 | +46% | `0378fdfc-5a74-4c9f-8001-9cd2785549bc` |
| [ ] | Chicken Ramen | $204 | Grande | $260 | +27% | `7c1610a6-fae6-4229-b8df-86a00728965b` |
| [ ] | Mixto | $228 | Corte grueso | $353 | +55% | `932e67e5-33d9-4c1c-8f99-5d4bb10d4d24` |
| [ ] | Mixto Especial | $270 | Corte grueso | $353 | +31% | `0cbedbd7-573f-43e3-ba70-423240f0e4ad` |
| [ ] | Pulpo | $201 | Corte grueso | $276 | +37% | `f6dab426-0338-4df1-8f41-33d3662b8400` |
| [ ] | Ramen Chashu | $204 | Grande | $260 | +27% | `fa6ed079-0f10-4378-a9b7-01ada2efe8a1` |
| [ ] | Robalo | $201 | Corte grueso | $276 | +37% | `fbf6e591-cbd1-4747-8fea-1c3c827cf302` |
| [ ] | Salmón | $201 | Corte grueso | $276 | +37% | `aee48219-5e75-4615-a546-f1e1eed4bf85` |
| [ ] | Salmón Ahumado | $228 | Corte grueso | $298 | +31% | `3755c2da-0661-47bd-bc7b-39dacc016369` |
| [ ] | Salmon Ramen | $204 | Grande | $260 | +27% | `0bd5b5d2-621d-49a1-b047-fa5e0ee5daee` |
| [ ] | Spicy Miso Ramen Beef | $204 | Grande | $260 | +27% | `689f1720-c048-4040-b037-15425618b760` |
