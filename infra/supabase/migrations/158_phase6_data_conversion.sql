-- 158_phase6_data_conversion.sql
-- Created: 2026-06-06
--
-- Dish-model rewrite Phase 6 — convert legacy parent/variant dishes into the
-- modifier model. Generated from prod by infra/scripts/preview-phase6-conversion.ts,
-- validated via the read-only preview + a replica dry-run (counts matched:
-- option_groups +66, options +181, dishes -244).
--
--   multi (>=2 children) -> option_group + options (absolute/delta base rule);
--   single/childless     -> collapse to standard (menu price + parsed portions);
--   244 folded children deleted; converted parents -> is_parent=false, enrichment_status='none'.
--
-- 51 single-child price discrepancies kept the menu price — operator spot-check
-- list in the footer. ⚠ Reverse is manual (no auto-rollback after COMMIT).
-- Re-embed after applying: infra/scripts/batch-embed.ts (targets enrichment_status none/failed).
-- Plan: docs/plans/dish-model-rewrite-phase-6-data-migration.md

BEGIN;

-- ===== MULTI → option groups (66 dishes) =====
-- Campechano  (base $70)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('bad479e0-5a6e-4432-806b-dc6d3bfa279b','f9485a21-e705-449d-b049-9f8a20254a9e','5185c782-83e2-4602-a07a-7f4e2546bb37','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'bad479e0-5a6e-4432-806b-dc6d3bfa279b','Campechano Chico',0,NULL,true,0,true),
  (gen_random_uuid(),'bad479e0-5a6e-4432-806b-dc6d3bfa279b','Campechano Mediano',70,NULL,false,1,true),
  (gen_random_uuid(),'bad479e0-5a6e-4432-806b-dc6d3bfa279b','Campechano Grande',110,NULL,false,2,true);
UPDATE dishes SET price=70,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='5185c782-83e2-4602-a07a-7f4e2546bb37';

-- Calamar  (base $70)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('c2ff0ad0-8f9e-47ad-a811-96f114930476','f9485a21-e705-449d-b049-9f8a20254a9e','f1c09bca-7de4-4fb0-a254-b8ebe1b7870b','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'c2ff0ad0-8f9e-47ad-a811-96f114930476','Calamar Chico',0,NULL,true,0,true),
  (gen_random_uuid(),'c2ff0ad0-8f9e-47ad-a811-96f114930476','Calamar Mediano',70,NULL,false,1,true),
  (gen_random_uuid(),'c2ff0ad0-8f9e-47ad-a811-96f114930476','Calamar Grande',110,NULL,false,2,true);
UPDATE dishes SET price=70,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='f1c09bca-7de4-4fb0-a254-b8ebe1b7870b';

-- Camarón  (base $70)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('76f13f9e-8fd0-4819-b22c-fb48523a2052','f9485a21-e705-449d-b049-9f8a20254a9e','c9469e85-3343-4755-927f-9b000e4cc2e3','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'76f13f9e-8fd0-4819-b22c-fb48523a2052','Camarón Chico',0,NULL,true,0,true),
  (gen_random_uuid(),'76f13f9e-8fd0-4819-b22c-fb48523a2052','Camarón Mediano',70,NULL,false,1,true),
  (gen_random_uuid(),'76f13f9e-8fd0-4819-b22c-fb48523a2052','Camarón Grande',110,NULL,false,2,true);
UPDATE dishes SET price=70,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='c9469e85-3343-4755-927f-9b000e4cc2e3';

-- Avocado Roll  (base $105)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('90f31211-41e8-4612-9563-1f9d0f5c0c0c','3d06c5f0-6fac-4177-b040-052b3a8dc349','687cc269-92d1-465f-b6d0-d08591387ec6','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'90f31211-41e8-4612-9563-1f9d0f5c0c0c','Vegetariano',0,NULL,true,0,true),
  (gen_random_uuid(),'90f31211-41e8-4612-9563-1f9d0f5c0c0c','Piel de salmon',13,NULL,false,1,true),
  (gen_random_uuid(),'90f31211-41e8-4612-9563-1f9d0f5c0c0c','Ostion ahumado',24,NULL,false,2,true),
  (gen_random_uuid(),'90f31211-41e8-4612-9563-1f9d0f5c0c0c','Cangrejo',34,NULL,false,3,true),
  (gen_random_uuid(),'90f31211-41e8-4612-9563-1f9d0f5c0c0c','Salmón',34,NULL,false,4,true),
  (gen_random_uuid(),'90f31211-41e8-4612-9563-1f9d0f5c0c0c','Camarón',34,NULL,false,5,true),
  (gen_random_uuid(),'90f31211-41e8-4612-9563-1f9d0f5c0c0c','Salmón ahumado',42,NULL,false,6,true),
  (gen_random_uuid(),'90f31211-41e8-4612-9563-1f9d0f5c0c0c','Anguila',76,NULL,false,7,true);
UPDATE dishes SET price=105,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='687cc269-92d1-465f-b6d0-d08591387ec6';

-- Pulpo  (base $70)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('ce04f9b3-6794-4343-a2e0-d0ef38f0a4b1','f9485a21-e705-449d-b049-9f8a20254a9e','17344ffc-88a2-424b-8b25-c1a02cb45d6d','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'ce04f9b3-6794-4343-a2e0-d0ef38f0a4b1','Pulpo Chico',0,NULL,true,0,true),
  (gen_random_uuid(),'ce04f9b3-6794-4343-a2e0-d0ef38f0a4b1','Pulpo Mediano',70,NULL,false,1,true),
  (gen_random_uuid(),'ce04f9b3-6794-4343-a2e0-d0ef38f0a4b1','Pulpo Grande',110,NULL,false,2,true);
UPDATE dishes SET price=70,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='17344ffc-88a2-424b-8b25-c1a02cb45d6d';

-- Pescado  (base $70)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('16d79331-bf4c-4cbb-a19a-f3ce520d8cab','f9485a21-e705-449d-b049-9f8a20254a9e','114fcd88-a38f-4fe1-a051-abc151581138','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'16d79331-bf4c-4cbb-a19a-f3ce520d8cab','Pescado Chico',0,NULL,true,0,true),
  (gen_random_uuid(),'16d79331-bf4c-4cbb-a19a-f3ce520d8cab','Pescado Mediano',70,NULL,false,1,true),
  (gen_random_uuid(),'16d79331-bf4c-4cbb-a19a-f3ce520d8cab','Pescado Grande',110,NULL,false,2,true);
UPDATE dishes SET price=70,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='114fcd88-a38f-4fe1-a051-abc151581138';

-- Ostión  (base $70)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('99bc493f-b91f-4e6d-82bd-c53f84421089','f9485a21-e705-449d-b049-9f8a20254a9e','e3182a17-9046-45be-bebf-0f60ac807214','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'99bc493f-b91f-4e6d-82bd-c53f84421089','Ostión Chico',0,NULL,true,0,true),
  (gen_random_uuid(),'99bc493f-b91f-4e6d-82bd-c53f84421089','Ostión Mediano',70,NULL,false,1,true),
  (gen_random_uuid(),'99bc493f-b91f-4e6d-82bd-c53f84421089','Ostión Grande',110,NULL,false,2,true);
UPDATE dishes SET price=70,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='e3182a17-9046-45be-bebf-0f60ac807214';

-- PASTA FETUCCINE  (base $345 [delta-mode])
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('3d082504-bf57-4081-8e60-91e6ce4d09be','503884be-6b78-4248-9e13-dd62b70bfd34','3589d035-7be5-4e1e-a446-1cdae8733765','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'3d082504-bf57-4081-8e60-91e6ce4d09be','Pollo',0,NULL,true,0,true),
  (gen_random_uuid(),'3d082504-bf57-4081-8e60-91e6ce4d09be','Salmon',35,NULL,false,1,true),
  (gen_random_uuid(),'3d082504-bf57-4081-8e60-91e6ce4d09be','Camaron(100 G)',35,NULL,false,2,true);
UPDATE dishes SET price=345,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='3589d035-7be5-4e1e-a446-1cdae8733765';

-- El Jornalero (Del Día)  (base $45)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('c443ed17-47a2-4dc5-ba7e-d3b49b6b74aa','37ba9982-89a1-4daa-932f-7cc4db47f5f5','f6935ec5-e489-4d19-a6ea-7338bccf27d0','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'c443ed17-47a2-4dc5-ba7e-d3b49b6b74aa','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'c443ed17-47a2-4dc5-ba7e-d3b49b6b74aa','Grande',5,NULL,false,1,true);
UPDATE dishes SET price=45,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='f6935ec5-e489-4d19-a6ea-7338bccf27d0';

-- Negra Flor  (base $80)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('e2209563-7155-495a-a60f-3ee8daeb91bc','37ba9982-89a1-4daa-932f-7cc4db47f5f5','a908ebf1-d552-4f1f-b22d-c79016aae62d','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'e2209563-7155-495a-a60f-3ee8daeb91bc','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'e2209563-7155-495a-a60f-3ee8daeb91bc','Grande',9,NULL,false,1,true);
UPDATE dishes SET price=80,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='a908ebf1-d552-4f1f-b22d-c79016aae62d';

-- Café Cacao  (base $74)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('a33f7cff-abf4-47fd-ba30-d173055f21d6','37ba9982-89a1-4daa-932f-7cc4db47f5f5','7dbc817f-93bb-4538-a91d-544e31000334','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'a33f7cff-abf4-47fd-ba30-d173055f21d6','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'a33f7cff-abf4-47fd-ba30-d173055f21d6','Grande',5,NULL,false,1,true);
UPDATE dishes SET price=74,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='7dbc817f-93bb-4538-a91d-544e31000334';

-- Dulce Madera (Canela y Pimienta Gorda)  (base $83)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('121f6227-2aed-4cb7-938a-0d689e16f754','37ba9982-89a1-4daa-932f-7cc4db47f5f5','92f74f60-950b-4181-b8ed-9ce8efe52cbc','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'121f6227-2aed-4cb7-938a-0d689e16f754','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'121f6227-2aed-4cb7-938a-0d689e16f754','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=83,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='92f74f60-950b-4181-b8ed-9ce8efe52cbc';

-- Menta  (base $74)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('8a664599-557a-4767-bcce-25658e164b22','37ba9982-89a1-4daa-932f-7cc4db47f5f5','7116c1c5-a647-4713-a344-710c6102651f','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'8a664599-557a-4767-bcce-25658e164b22','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'8a664599-557a-4767-bcce-25658e164b22','Grande',5,NULL,false,1,true);
UPDATE dishes SET price=74,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='7116c1c5-a647-4713-a344-710c6102651f';

-- Café con Leche  (base $66)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('7cb071e3-9d0b-486a-b90d-b1a30f1fb950','37ba9982-89a1-4daa-932f-7cc4db47f5f5','d2415b12-58f7-44f8-907e-c837f3313316','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'7cb071e3-9d0b-486a-b90d-b1a30f1fb950','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'7cb071e3-9d0b-486a-b90d-b1a30f1fb950','Grande',11,NULL,false,1,true);
UPDATE dishes SET price=66,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='d2415b12-58f7-44f8-907e-c837f3313316';

-- Capuchino  (base $66)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('26dfe221-cc96-4a35-a04c-e7afd2cb3d71','37ba9982-89a1-4daa-932f-7cc4db47f5f5','c0d0e74b-2c3e-43bd-964d-72407632d71e','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'26dfe221-cc96-4a35-a04c-e7afd2cb3d71','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'26dfe221-cc96-4a35-a04c-e7afd2cb3d71','Grande',11,NULL,false,1,true);
UPDATE dishes SET price=66,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='c0d0e74b-2c3e-43bd-964d-72407632d71e';

-- Espresso Americano  (base $53)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('a8fd4902-c36c-4756-93f9-2e8d38c69bce','37ba9982-89a1-4daa-932f-7cc4db47f5f5','3d5a434b-459d-438a-ba3d-f3bc8d6e057f','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'a8fd4902-c36c-4756-93f9-2e8d38c69bce','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'a8fd4902-c36c-4756-93f9-2e8d38c69bce','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=53,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='3d5a434b-459d-438a-ba3d-f3bc8d6e057f';

-- Mocha Blanco  (base $80)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('0a56776f-87ba-463f-b717-a52682d26428','37ba9982-89a1-4daa-932f-7cc4db47f5f5','c4db5300-2827-4912-9683-5c101d7a6d81','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'0a56776f-87ba-463f-b717-a52682d26428','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'0a56776f-87ba-463f-b717-a52682d26428','Grande',9,NULL,false,1,true);
UPDATE dishes SET price=80,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='c4db5300-2827-4912-9683-5c101d7a6d81';

-- Vainilla Americano  (base $63)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('fa943d2b-6fe6-49e3-b262-ad4ce644615b','37ba9982-89a1-4daa-932f-7cc4db47f5f5','a1a6a5d3-2472-4cd0-90ed-8cc2dff9135d','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'fa943d2b-6fe6-49e3-b262-ad4ce644615b','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'fa943d2b-6fe6-49e3-b262-ad4ce644615b','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=63,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='a1a6a5d3-2472-4cd0-90ed-8cc2dff9135d';

-- Café Cacao  (base $80)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('939a0ec1-a38c-4539-9987-b0d015cba179','37ba9982-89a1-4daa-932f-7cc4db47f5f5','5324f177-ba1b-4e91-9591-0c81ebf1efda','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'939a0ec1-a38c-4539-9987-b0d015cba179','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'939a0ec1-a38c-4539-9987-b0d015cba179','Grande',9,NULL,false,1,true);
UPDATE dishes SET price=80,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='5324f177-ba1b-4e91-9591-0c81ebf1efda';

-- Chiltepin  (base $80)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('f33e4c72-527c-4c36-94c1-0a078ef02764','37ba9982-89a1-4daa-932f-7cc4db47f5f5','6f9bddbd-091b-4e80-879b-e40f1498425a','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'f33e4c72-527c-4c36-94c1-0a078ef02764','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'f33e4c72-527c-4c36-94c1-0a078ef02764','Grande',9,NULL,false,1,true);
UPDATE dishes SET price=80,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='6f9bddbd-091b-4e80-879b-e40f1498425a';

-- Chocolate Blanco  (base $74)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('676e444e-0dae-46e2-94b6-56fa5843ec4e','37ba9982-89a1-4daa-932f-7cc4db47f5f5','a765a819-56c4-4629-a61a-1768ae5df0ed','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'676e444e-0dae-46e2-94b6-56fa5843ec4e','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'676e444e-0dae-46e2-94b6-56fa5843ec4e','Grande',5,NULL,false,1,true);
UPDATE dishes SET price=74,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='a765a819-56c4-4629-a61a-1768ae5df0ed';

-- Criollo (Cacao Natural)  (base $68)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('ed5821cc-47d6-430f-8025-916188226bdc','37ba9982-89a1-4daa-932f-7cc4db47f5f5','c21351cf-fbcf-4183-bcb2-af8881cc707f','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'ed5821cc-47d6-430f-8025-916188226bdc','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'ed5821cc-47d6-430f-8025-916188226bdc','Grande',9,NULL,false,1,true);
UPDATE dishes SET price=68,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='c21351cf-fbcf-4183-bcb2-af8881cc707f';

-- Dulce Madera  (base $74)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('1016a937-3166-4cc9-904d-9b398f806faa','37ba9982-89a1-4daa-932f-7cc4db47f5f5','31d28819-c81d-4230-b480-76a27bc37b91','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'1016a937-3166-4cc9-904d-9b398f806faa','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'1016a937-3166-4cc9-904d-9b398f806faa','Grande',5,NULL,false,1,true);
UPDATE dishes SET price=74,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='31d28819-c81d-4230-b480-76a27bc37b91';

-- Naranjo Huacal  (base $74)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('71bf7fdd-605d-4215-9ba7-e1af5a4e42c5','37ba9982-89a1-4daa-932f-7cc4db47f5f5','b97c5f8c-4b80-423e-ae37-397d74eaff36','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'71bf7fdd-605d-4215-9ba7-e1af5a4e42c5','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'71bf7fdd-605d-4215-9ba7-e1af5a4e42c5','Grande',5,NULL,false,1,true);
UPDATE dishes SET price=74,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='b97c5f8c-4b80-423e-ae37-397d74eaff36';

-- Negra Flor  (base $74)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('aca7130a-3da4-4f08-b510-7669490f4bf4','37ba9982-89a1-4daa-932f-7cc4db47f5f5','5fdaaf92-5963-444d-9958-76906732518b','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'aca7130a-3da4-4f08-b510-7669490f4bf4','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'aca7130a-3da4-4f08-b510-7669490f4bf4','Grande',5,NULL,false,1,true);
UPDATE dishes SET price=74,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='5fdaaf92-5963-444d-9958-76906732518b';

-- Criollo  (base $76)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('5181739a-4ae9-4585-b6f8-f5796890aca8','37ba9982-89a1-4daa-932f-7cc4db47f5f5','c62360a5-1101-4c3f-81d9-57b19917402d','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'5181739a-4ae9-4585-b6f8-f5796890aca8','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'5181739a-4ae9-4585-b6f8-f5796890aca8','Grande',3,NULL,false,1,true);
UPDATE dishes SET price=76,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='c62360a5-1101-4c3f-81d9-57b19917402d';

-- Dulce Madera  (base $80)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('2dae810c-5507-4c37-9082-f8e0ad4da36b','37ba9982-89a1-4daa-932f-7cc4db47f5f5','c728999f-a235-4369-b5d2-2eff748f3fcf','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'2dae810c-5507-4c37-9082-f8e0ad4da36b','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'2dae810c-5507-4c37-9082-f8e0ad4da36b','Grande',9,NULL,false,1,true);
UPDATE dishes SET price=80,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='c728999f-a235-4369-b5d2-2eff748f3fcf';

-- Naranjo Huacal  (base $80)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('61b7d38e-8860-48eb-897d-d359079248d5','37ba9982-89a1-4daa-932f-7cc4db47f5f5','49c33687-8411-4fb9-a768-64477456bf9a','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'61b7d38e-8860-48eb-897d-d359079248d5','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'61b7d38e-8860-48eb-897d-d359079248d5','Grande',9,NULL,false,1,true);
UPDATE dishes SET price=80,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='49c33687-8411-4fb9-a768-64477456bf9a';

-- Estrella  (base $74)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('96643572-c944-4bd5-81db-fe9cbe6b8a48','37ba9982-89a1-4daa-932f-7cc4db47f5f5','ff002659-4b55-479f-b629-f33263b97463','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'96643572-c944-4bd5-81db-fe9cbe6b8a48','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'96643572-c944-4bd5-81db-fe9cbe6b8a48','Grande',5,NULL,false,1,true);
UPDATE dishes SET price=74,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='ff002659-4b55-479f-b629-f33263b97463';

-- Café  (base $75)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('11018e96-9249-43a4-a4ac-26117f1bf3b9','37ba9982-89a1-4daa-932f-7cc4db47f5f5','d9e043eb-ff53-47f0-bb38-a5ea05119f6d','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'11018e96-9249-43a4-a4ac-26117f1bf3b9','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'11018e96-9249-43a4-a4ac-26117f1bf3b9','Grande',5,NULL,false,1,true);
UPDATE dishes SET price=75,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='d9e043eb-ff53-47f0-bb38-a5ea05119f6d';

-- Mocha  (base $83)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('c8a7e4cb-fa6f-4fc2-bf6b-b2ef36353815','37ba9982-89a1-4daa-932f-7cc4db47f5f5','92cbbcf1-c964-40a4-a3b5-a35a04be2260','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'c8a7e4cb-fa6f-4fc2-bf6b-b2ef36353815','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'c8a7e4cb-fa6f-4fc2-bf6b-b2ef36353815','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=83,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='92cbbcf1-c964-40a4-a3b5-a35a04be2260';

-- Caramelo  (base $83)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('d18859ce-0f11-4bcd-8d60-f21060c129f2','37ba9982-89a1-4daa-932f-7cc4db47f5f5','e8052ff7-0eb6-4a56-b804-4aebd3d2550d','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'d18859ce-0f11-4bcd-8d60-f21060c129f2','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'d18859ce-0f11-4bcd-8d60-f21060c129f2','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=83,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='e8052ff7-0eb6-4a56-b804-4aebd3d2550d';

-- Arroz con Leche  (base $83)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('c383642b-8147-48aa-9976-ef3cfdd183aa','37ba9982-89a1-4daa-932f-7cc4db47f5f5','6a59e288-bf40-40fe-baa8-aaca457beb93','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'c383642b-8147-48aa-9976-ef3cfdd183aa','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'c383642b-8147-48aa-9976-ef3cfdd183aa','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=83,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='6a59e288-bf40-40fe-baa8-aaca457beb93';

-- Café Light  (base $83)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('33e3a05b-b131-42b4-b058-a1225a01472e','37ba9982-89a1-4daa-932f-7cc4db47f5f5','1d33ec75-3865-4cbc-89b8-f5608bf9c3f7','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'33e3a05b-b131-42b4-b058-a1225a01472e','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'33e3a05b-b131-42b4-b058-a1225a01472e','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=83,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='1d33ec75-3865-4cbc-89b8-f5608bf9c3f7';

-- Vainilla  (base $83)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('8e2224d6-c349-4104-93c2-b6d4ec4f2334','37ba9982-89a1-4daa-932f-7cc4db47f5f5','0596e206-3ab7-4b42-819e-6811ef74bd58','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'8e2224d6-c349-4104-93c2-b6d4ec4f2334','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'8e2224d6-c349-4104-93c2-b6d4ec4f2334','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=83,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='0596e206-3ab7-4b42-819e-6811ef74bd58';

-- Chai  (base $83)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('62cf8a30-36fc-4fb3-8dfc-409e60098e81','37ba9982-89a1-4daa-932f-7cc4db47f5f5','dce857ca-ccad-46fd-afa0-f62b7b738467','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'62cf8a30-36fc-4fb3-8dfc-409e60098e81','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'62cf8a30-36fc-4fb3-8dfc-409e60098e81','Grande',5.989999999999995,NULL,false,1,true);
UPDATE dishes SET price=83,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='dce857ca-ccad-46fd-afa0-f62b7b738467';

-- Matcha Artesano  (base $83)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('0cddd66a-c687-4854-9403-2c2440cf4755','37ba9982-89a1-4daa-932f-7cc4db47f5f5','986b892e-35d0-4db2-9468-e951f9013481','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'0cddd66a-c687-4854-9403-2c2440cf4755','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'0cddd66a-c687-4854-9403-2c2440cf4755','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=83,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='986b892e-35d0-4db2-9468-e951f9013481';

-- Taro  (base $83)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('488d8ff1-f9b3-418a-ad7c-b2fbb51db7ae','37ba9982-89a1-4daa-932f-7cc4db47f5f5','1fda37b2-50d7-47a9-942f-251faff6e8aa','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'488d8ff1-f9b3-418a-ad7c-b2fbb51db7ae','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'488d8ff1-f9b3-418a-ad7c-b2fbb51db7ae','Grande',5.989999999999995,NULL,false,1,true);
UPDATE dishes SET price=83,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='1fda37b2-50d7-47a9-942f-251faff6e8aa';

-- Palmar Tropical (Coco)  (base $79 [delta-mode])
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('f7109d80-b748-4cf7-bff3-7076c6c0820f','37ba9982-89a1-4daa-932f-7cc4db47f5f5','d70c5bd0-0a05-4f7c-a24f-db1d5a07fbb1','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'f7109d80-b748-4cf7-bff3-7076c6c0820f','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'f7109d80-b748-4cf7-bff3-7076c6c0820f','Grande',0,NULL,false,1,true);
UPDATE dishes SET price=79,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='d70c5bd0-0a05-4f7c-a24f-db1d5a07fbb1';

-- Paraíso Caribeño (Piña y Coco)  (base $89)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('70546747-f01e-416f-bb81-6dfd2149a5bc','37ba9982-89a1-4daa-932f-7cc4db47f5f5','d869ee20-5160-49aa-a45e-0efe1a7a3a35','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'70546747-f01e-416f-bb81-6dfd2149a5bc','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'70546747-f01e-416f-bb81-6dfd2149a5bc','Grande',5,NULL,false,1,true);
UPDATE dishes SET price=89,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='d869ee20-5160-49aa-a45e-0efe1a7a3a35';

-- Chiltepin (Piquín, Pimienta Gorda y Achiote)  (base $83)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('dd2a1f5b-6d9d-465e-9703-78d30e3a9edf','37ba9982-89a1-4daa-932f-7cc4db47f5f5','05594389-f5a4-4214-98ae-4057a3ca08e8','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'dd2a1f5b-6d9d-465e-9703-78d30e3a9edf','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'dd2a1f5b-6d9d-465e-9703-78d30e3a9edf','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=83,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='05594389-f5a4-4214-98ae-4057a3ca08e8';

-- Negra Flor (Vainilla)  (base $83)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('a310a0fa-9d3d-4d8b-9af3-3828d6b2c552','37ba9982-89a1-4daa-932f-7cc4db47f5f5','ce2a6b52-451e-4093-9fb3-511f36716fff','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'a310a0fa-9d3d-4d8b-9af3-3828d6b2c552','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'a310a0fa-9d3d-4d8b-9af3-3828d6b2c552','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=83,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='ce2a6b52-451e-4093-9fb3-511f36716fff';

-- Naranjo Huacal (Naranja y Jengibre)  (base $83)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('ab72ba42-442c-4097-962d-66427680a411','37ba9982-89a1-4daa-932f-7cc4db47f5f5','0e7d03ff-3fdc-4cf0-b7e3-197bed4e2dfe','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'ab72ba42-442c-4097-962d-66427680a411','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'ab72ba42-442c-4097-962d-66427680a411','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=83,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='0e7d03ff-3fdc-4cf0-b7e3-197bed4e2dfe';

-- Chai  (base $58)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('be49d7d8-c0f6-4406-a7e7-798ecc5e56b8','37ba9982-89a1-4daa-932f-7cc4db47f5f5','1c92af3f-1162-4be9-a7e4-0421a7f60fe8','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'be49d7d8-c0f6-4406-a7e7-798ecc5e56b8','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'be49d7d8-c0f6-4406-a7e7-798ecc5e56b8','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=58,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='1c92af3f-1162-4be9-a7e4-0421a7f60fe8';

-- Limoncillo  (base $58)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('7d8f98dc-43c7-4954-b0ca-aa23e0dbc504','37ba9982-89a1-4daa-932f-7cc4db47f5f5','3fb60e3e-b41e-49e7-8d93-2a5bcccc4010','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'7d8f98dc-43c7-4954-b0ca-aa23e0dbc504','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'7d8f98dc-43c7-4954-b0ca-aa23e0dbc504','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=58,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='3fb60e3e-b41e-49e7-8d93-2a5bcccc4010';

-- Menta Cítrica  (base $58)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('c7e09eb7-7be7-48db-a023-1bb10ee4374b','37ba9982-89a1-4daa-932f-7cc4db47f5f5','ab688b86-9896-4ce2-bc83-0cd46e625d7f','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'c7e09eb7-7be7-48db-a023-1bb10ee4374b','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'c7e09eb7-7be7-48db-a023-1bb10ee4374b','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=58,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='ab688b86-9896-4ce2-bc83-0cd46e625d7f';

-- Pera del Bey  (base $58)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('473fb7e8-b044-45f4-9f3a-89508a65337b','37ba9982-89a1-4daa-932f-7cc4db47f5f5','1dde68dc-efc6-47bd-9b18-0834a5afb3cc','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'473fb7e8-b044-45f4-9f3a-89508a65337b','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'473fb7e8-b044-45f4-9f3a-89508a65337b','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=58,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='1dde68dc-efc6-47bd-9b18-0834a5afb3cc';

-- Frutal  (base $69)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('5f818728-1f8a-4b64-a1e8-14ae3a0c2206','37ba9982-89a1-4daa-932f-7cc4db47f5f5','a4f8d815-f2ea-4225-9f17-650b9f822c46','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'5f818728-1f8a-4b64-a1e8-14ae3a0c2206','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'5f818728-1f8a-4b64-a1e8-14ae3a0c2206','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=69,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='a4f8d815-f2ea-4225-9f17-650b9f822c46';

-- Primaveral  (base $69)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('93716054-9777-4fcc-a017-7d444aa72229','37ba9982-89a1-4daa-932f-7cc4db47f5f5','348c7c3c-ea8c-4d34-820e-38f262b1256f','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'93716054-9777-4fcc-a017-7d444aa72229','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'93716054-9777-4fcc-a017-7d444aa72229','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=69,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='348c7c3c-ea8c-4d34-820e-38f262b1256f';

-- Salvaje  (base $69)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('db001a5e-4ffe-4b42-a0e4-593f93ccab15','37ba9982-89a1-4daa-932f-7cc4db47f5f5','4bad84d8-e222-430e-94e5-38ba3ed5768d','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'db001a5e-4ffe-4b42-a0e4-593f93ccab15','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'db001a5e-4ffe-4b42-a0e4-593f93ccab15','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=69,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='4bad84d8-e222-430e-94e5-38ba3ed5768d';

-- Guayaba con Chía  (base $55)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('eba78f1e-94f4-4d24-a9ec-8754e132492b','37ba9982-89a1-4daa-932f-7cc4db47f5f5','b84847e2-a432-4b47-9164-208da9001c87','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'eba78f1e-94f4-4d24-a9ec-8754e132492b','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'eba78f1e-94f4-4d24-a9ec-8754e132492b','Grande',4,NULL,false,1,true);
UPDATE dishes SET price=55,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='b84847e2-a432-4b47-9164-208da9001c87';

-- Limón con Chía  (base $55)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('42baef3a-0f58-4a90-9bea-4ae65876d466','37ba9982-89a1-4daa-932f-7cc4db47f5f5','dd3f337b-a4cb-4854-8fdf-fabc37805157','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'42baef3a-0f58-4a90-9bea-4ae65876d466','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'42baef3a-0f58-4a90-9bea-4ae65876d466','Grande',3.990000000000002,NULL,false,1,true);
UPDATE dishes SET price=55,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='dd3f337b-a4cb-4854-8fdf-fabc37805157';

-- Chocolate Blanco  (base $83)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('4de79df1-27b4-4bb3-bc2a-e4b60db2b74a','37ba9982-89a1-4daa-932f-7cc4db47f5f5','f9cad402-3b2f-4612-9def-6ef1f899aaf9','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'4de79df1-27b4-4bb3-bc2a-e4b60db2b74a','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'4de79df1-27b4-4bb3-bc2a-e4b60db2b74a','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=83,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='f9cad402-3b2f-4612-9def-6ef1f899aaf9';

-- Café Cacao (Trocitos de Café)  (base $83)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('0339ba84-76dd-4add-a3a5-0ea5910778d5','37ba9982-89a1-4daa-932f-7cc4db47f5f5','4055beb3-b2ba-4a9f-93ad-4be83ef09139','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'0339ba84-76dd-4add-a3a5-0ea5910778d5','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'0339ba84-76dd-4add-a3a5-0ea5910778d5','Grande',6,NULL,false,1,true);
UPDATE dishes SET price=83,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='4055beb3-b2ba-4a9f-93ad-4be83ef09139';

-- Criollo (Cacao Natural)  (base $76)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('6713658a-31df-4b9b-9169-89f217571bbf','37ba9982-89a1-4daa-932f-7cc4db47f5f5','1c0f3691-05c4-48e7-8c0f-e9c8f1682d25','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'6713658a-31df-4b9b-9169-89f217571bbf','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'6713658a-31df-4b9b-9169-89f217571bbf','Grande',9,NULL,false,1,true);
UPDATE dishes SET price=76,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='1c0f3691-05c4-48e7-8c0f-e9c8f1682d25';

-- Bosque Carmesí (Frutos Rojos)  (base $89)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('5b5df83d-fe0a-4f67-95aa-fae241f10599','37ba9982-89a1-4daa-932f-7cc4db47f5f5','9de19bf9-d3a9-4c7b-a4fb-0e34039036bf','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'5b5df83d-fe0a-4f67-95aa-fae241f10599','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'5b5df83d-fe0a-4f67-95aa-fae241f10599','Grande',5,NULL,false,1,true);
UPDATE dishes SET price=89,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='9de19bf9-d3a9-4c7b-a4fb-0e34039036bf';

-- JARRA DE CERVEZA  (base $25)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('f5a37ec3-4e5c-47a8-9ae8-0476f89c25b7','b4d71454-d43d-4306-84cf-7b34b6e881fd','6a1e0e48-ad57-42af-84c9-43841388cce6','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'f5a37ec3-4e5c-47a8-9ae8-0476f89c25b7','+Michelada',0,NULL,true,0,true),
  (gen_random_uuid(),'f5a37ec3-4e5c-47a8-9ae8-0476f89c25b7','+Cubano',0,NULL,false,1,true),
  (gen_random_uuid(),'f5a37ec3-4e5c-47a8-9ae8-0476f89c25b7','+Clamato',5,NULL,false,2,true);
UPDATE dishes SET price=25,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='6a1e0e48-ad57-42af-84c9-43841388cce6';

-- LITRO DE CERVEZA  (base $35)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('66cd8c32-4fe1-438b-9d76-11174029b880','b4d71454-d43d-4306-84cf-7b34b6e881fd','7588f548-8e0e-4faa-8aa6-46410e91f3b9','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'66cd8c32-4fe1-438b-9d76-11174029b880','+Michelada',0,NULL,true,0,true),
  (gen_random_uuid(),'66cd8c32-4fe1-438b-9d76-11174029b880','+Cubano',10,NULL,false,1,true),
  (gen_random_uuid(),'66cd8c32-4fe1-438b-9d76-11174029b880','+Clamato',15,NULL,false,2,true);
UPDATE dishes SET price=35,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='7588f548-8e0e-4faa-8aa6-46410e91f3b9';

-- YASAI  (base $210)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('aa90270e-e159-4e69-b496-71b4a6620816','3d06c5f0-6fac-4177-b040-052b3a8dc349','06dc447c-753e-4fbb-942f-02e39cb017cc','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'aa90270e-e159-4e69-b496-71b4a6620816','Cangrejo',0,NULL,true,0,true),
  (gen_random_uuid(),'aa90270e-e159-4e69-b496-71b4a6620816','Salmón',0,NULL,false,1,true),
  (gen_random_uuid(),'aa90270e-e159-4e69-b496-71b4a6620816','Sushi Roll',55,NULL,false,2,true);
UPDATE dishes SET price=210,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='06dc447c-753e-4fbb-942f-02e39cb017cc';

-- Queso Roll  (base $111)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('5a64681a-2d08-4346-88c0-ff820529d7da','3d06c5f0-6fac-4177-b040-052b3a8dc349','2b2c01ef-d116-4d5e-aef3-68c834e71cf8','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'5a64681a-2d08-4346-88c0-ff820529d7da','Vegetariano',0,NULL,true,0,true),
  (gen_random_uuid(),'5a64681a-2d08-4346-88c0-ff820529d7da','Piel de salmon',14,NULL,false,1,true),
  (gen_random_uuid(),'5a64681a-2d08-4346-88c0-ff820529d7da','Ostion ahumado',24,NULL,false,2,true),
  (gen_random_uuid(),'5a64681a-2d08-4346-88c0-ff820529d7da','Camarón',34,NULL,false,3,true),
  (gen_random_uuid(),'5a64681a-2d08-4346-88c0-ff820529d7da','Cangrejo',34,NULL,false,4,true),
  (gen_random_uuid(),'5a64681a-2d08-4346-88c0-ff820529d7da','Salmón',34,NULL,false,5,true),
  (gen_random_uuid(),'5a64681a-2d08-4346-88c0-ff820529d7da','Salmón ahumado',42,NULL,false,6,true),
  (gen_random_uuid(),'5a64681a-2d08-4346-88c0-ff820529d7da','Anguila',76,NULL,false,7,true);
UPDATE dishes SET price=111,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='2b2c01ef-d116-4d5e-aef3-68c834e71cf8';

-- Chiltepin  (base $74)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('504650dd-3fea-44c8-98f9-985999d601ba','37ba9982-89a1-4daa-932f-7cc4db47f5f5','4d19e24b-62fd-418e-b27f-fdfd08be4b23','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'504650dd-3fea-44c8-98f9-985999d601ba','Mediano',0,NULL,true,0,true),
  (gen_random_uuid(),'504650dd-3fea-44c8-98f9-985999d601ba','Grande',5,NULL,false,1,true);
UPDATE dishes SET price=74,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='4d19e24b-62fd-418e-b27f-fdfd08be4b23';

-- Carrusel Roll  (base $153)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('218e30cd-5dc2-4c3f-892f-4509653185d8','3d06c5f0-6fac-4177-b040-052b3a8dc349','46130931-c004-436c-8d9c-7dc7a33928a1','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'218e30cd-5dc2-4c3f-892f-4509653185d8','Pulpo',0,NULL,true,0,true),
  (gen_random_uuid(),'218e30cd-5dc2-4c3f-892f-4509653185d8','Cangrejo',0,NULL,false,1,true),
  (gen_random_uuid(),'218e30cd-5dc2-4c3f-892f-4509653185d8','Salmón',0,NULL,false,2,true),
  (gen_random_uuid(),'218e30cd-5dc2-4c3f-892f-4509653185d8','Camarón',0,NULL,false,3,true),
  (gen_random_uuid(),'218e30cd-5dc2-4c3f-892f-4509653185d8','Salmón ahumado',9,NULL,false,4,true),
  (gen_random_uuid(),'218e30cd-5dc2-4c3f-892f-4509653185d8','Anguila',43,NULL,false,5,true);
UPDATE dishes SET price=153,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='46130931-c004-436c-8d9c-7dc7a33928a1';

-- Outside Roll  (base $163)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('81e92cac-d4d3-4689-8fa9-e0ffcf34ea1e','3d06c5f0-6fac-4177-b040-052b3a8dc349','ad51b541-0d09-4911-9a6a-af9bce5f723f','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'81e92cac-d4d3-4689-8fa9-e0ffcf34ea1e','Cangrejo',0,NULL,true,0,true),
  (gen_random_uuid(),'81e92cac-d4d3-4689-8fa9-e0ffcf34ea1e','Atún',17,NULL,false,1,true),
  (gen_random_uuid(),'81e92cac-d4d3-4689-8fa9-e0ffcf34ea1e','Salmón ahumado',17,NULL,false,2,true),
  (gen_random_uuid(),'81e92cac-d4d3-4689-8fa9-e0ffcf34ea1e','Camarón',17,NULL,false,3,true),
  (gen_random_uuid(),'81e92cac-d4d3-4689-8fa9-e0ffcf34ea1e','Salmón',17,NULL,false,4,true),
  (gen_random_uuid(),'81e92cac-d4d3-4689-8fa9-e0ffcf34ea1e','Anguila',62,NULL,false,5,true),
  (gen_random_uuid(),'81e92cac-d4d3-4689-8fa9-e0ffcf34ea1e','Pulpo',62,NULL,false,6,true);
UPDATE dishes SET price=163,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='ad51b541-0d09-4911-9a6a-af9bce5f723f';

-- Filadelfia Roll  (base $80)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('3c1dc758-45cb-476d-a328-e84687bdc4dd','3d06c5f0-6fac-4177-b040-052b3a8dc349','48979806-26bd-423b-87ff-183dbb6703f1','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'3c1dc758-45cb-476d-a328-e84687bdc4dd','Pepino',0,NULL,true,0,true),
  (gen_random_uuid(),'3c1dc758-45cb-476d-a328-e84687bdc4dd','Piel de salmon',14,NULL,false,1,true),
  (gen_random_uuid(),'3c1dc758-45cb-476d-a328-e84687bdc4dd','Ostion ahumado',24,NULL,false,2,true),
  (gen_random_uuid(),'3c1dc758-45cb-476d-a328-e84687bdc4dd','Camarón',34,NULL,false,3,true),
  (gen_random_uuid(),'3c1dc758-45cb-476d-a328-e84687bdc4dd','Atún',34,NULL,false,4,true),
  (gen_random_uuid(),'3c1dc758-45cb-476d-a328-e84687bdc4dd','Salmón',34,NULL,false,5,true),
  (gen_random_uuid(),'3c1dc758-45cb-476d-a328-e84687bdc4dd','Cangrejo',34,NULL,false,6,true),
  (gen_random_uuid(),'3c1dc758-45cb-476d-a328-e84687bdc4dd','Salmón ahumado',43,NULL,false,7,true);
UPDATE dishes SET price=80,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='48979806-26bd-423b-87ff-183dbb6703f1';

-- Kuiri Roll  (base $97)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('d09c9a2b-3054-4b18-b847-5750facf48b8','3d06c5f0-6fac-4177-b040-052b3a8dc349','04e3800f-9f7b-4fdf-bd4b-018727723cc4','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'d09c9a2b-3054-4b18-b847-5750facf48b8','Vegetariano',0,NULL,true,0,true),
  (gen_random_uuid(),'d09c9a2b-3054-4b18-b847-5750facf48b8','Ostion ahumado',24,NULL,false,1,true),
  (gen_random_uuid(),'d09c9a2b-3054-4b18-b847-5750facf48b8','Camarón',34,NULL,false,2,true),
  (gen_random_uuid(),'d09c9a2b-3054-4b18-b847-5750facf48b8','Piel de salmon y tampico',34,NULL,false,3,true),
  (gen_random_uuid(),'d09c9a2b-3054-4b18-b847-5750facf48b8','Atún',34,NULL,false,4,true),
  (gen_random_uuid(),'d09c9a2b-3054-4b18-b847-5750facf48b8','Cangrejo',34,NULL,false,5,true),
  (gen_random_uuid(),'d09c9a2b-3054-4b18-b847-5750facf48b8','Salmón',34,NULL,false,6,true);
UPDATE dishes SET price=97,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='04e3800f-9f7b-4fdf-bd4b-018727723cc4';

-- California Roll  (base $97)
INSERT INTO option_groups (id,restaurant_id,dish_id,name,selection_type,min_selections,max_selections,display_order,is_active,display_in_card) VALUES ('d5076562-790d-4cdc-a839-7f829c78b231','3d06c5f0-6fac-4177-b040-052b3a8dc349','048f0a78-ee54-43d9-bfc5-7cf9a71bf0df','Elige una opción','single',1,1,0,true,false);
INSERT INTO options (id,option_group_id,name,price_delta,primary_protein,is_default,display_order,is_available) VALUES
  (gen_random_uuid(),'d5076562-790d-4cdc-a839-7f829c78b231','Vegetariano',0,NULL,true,0,true),
  (gen_random_uuid(),'d5076562-790d-4cdc-a839-7f829c78b231','Piel de salmon',13,NULL,false,1,true),
  (gen_random_uuid(),'d5076562-790d-4cdc-a839-7f829c78b231','Tampico',24,NULL,false,2,true),
  (gen_random_uuid(),'d5076562-790d-4cdc-a839-7f829c78b231','Ostion ahumado',24,NULL,false,3,true),
  (gen_random_uuid(),'d5076562-790d-4cdc-a839-7f829c78b231','Salmón',34,NULL,false,4,true),
  (gen_random_uuid(),'d5076562-790d-4cdc-a839-7f829c78b231','Pulpo',34,NULL,false,5,true),
  (gen_random_uuid(),'d5076562-790d-4cdc-a839-7f829c78b231','Cangrejo',34,NULL,false,6,true),
  (gen_random_uuid(),'d5076562-790d-4cdc-a839-7f829c78b231','Camarón',34,NULL,false,7,true),
  (gen_random_uuid(),'d5076562-790d-4cdc-a839-7f829c78b231','Anguila',76,NULL,false,8,true);
UPDATE dishes SET price=97,display_price_prefix='from',is_parent=false,enrichment_status='none' WHERE id='048f0a78-ee54-43d9-bfc5-7cf9a71bf0df';


-- ===== COLLAPSE single/childless → standard (69 dishes) =====
UPDATE dishes SET price=240, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='8c2fc014-3de7-4d6d-bec1-33468a2f7ff8';  -- "+ pechuga de pollo 120 g"
UPDATE dishes SET price=204, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='7c1610a6-fae6-4229-b8df-86a00728965b';  -- "Grande"
UPDATE dishes SET price=179, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='0378fdfc-5a74-4c9f-8001-9cd2785549bc';  -- "Corte grueso"
UPDATE dishes SET price=201, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='f6dab426-0338-4df1-8f41-33d3662b8400';  -- "Corte grueso"
UPDATE dishes SET price=201, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='fbf6e591-cbd1-4747-8fea-1c3c827cf302';  -- "Corte grueso"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='d1299355-0490-4da0-9232-518aae22d556';  -- "Grande"
UPDATE dishes SET price=195, is_parent=false, enrichment_status='none', portion_amount=100, portion_unit='g' WHERE id='b8b9aa32-a224-47fc-bb45-47351e5f2e3e';  -- "100 gr."
UPDATE dishes SET price=350, is_parent=false, enrichment_status='none', portion_amount=100, portion_unit='g' WHERE id='8c2188ac-a0e9-428f-9974-b7811274a9d4';  -- "100 gr."
UPDATE dishes SET price=195, is_parent=false, enrichment_status='none', portion_amount=100, portion_unit='g' WHERE id='a0a05c36-deff-4230-9b5a-f09139bce10b';  -- "100 gr."
UPDATE dishes SET price=450, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='d589e9e5-06ad-4ac1-87a4-006049517204';  -- "Querido Vegano: Pídela sin ventresca"
UPDATE dishes SET price=190, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='96462e39-6319-4ebb-9715-1cd6d5c35e99';  -- "1 rac"
UPDATE dishes SET price=46, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='64ba89ed-a9eb-4e10-8d8a-e66937fa0863';  -- "Mediano"
UPDATE dishes SET price=59, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='020122f4-7ec6-48ca-af35-7d485cd3d364';  -- "Mediano"
UPDATE dishes SET price=46, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='41534bd5-e8c3-4c43-8f0f-447dd23062f3';  -- "Mediano"
UPDATE dishes SET price=46, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='9a0a56b1-9354-4943-b73d-5443bc3ef721';  -- "Mediano"
UPDATE dishes SET price=46, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='e86a2a4f-3222-476d-a639-d4f83c46d89b';  -- "Mediano"
UPDATE dishes SET price=59, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='ce387a2f-abe4-4884-aadb-ab11516953a9';  -- "Mediano"
UPDATE dishes SET price=190, is_parent=false, enrichment_status='none', portion_amount=10, portion_unit='pcs' WHERE id='11f980c5-eff4-4676-9c34-7bf5d66e4a4b';  -- "10 uds"
UPDATE dishes SET price=59, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='f147716c-5493-46d7-80e3-b329b5d22133';  -- "Mediano"
UPDATE dishes SET price=160, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='d031c583-0414-45b8-92dc-227b57b37b5d';  -- "1 rac"
UPDATE dishes SET price=189, is_parent=false, enrichment_status='none', portion_amount=25, portion_unit='pcs' WHERE id='b16c7933-f607-4881-896c-f4d3701f817c';  -- "25 piezas incluye 2 aderezos 3 salsas a elegir"
UPDATE dishes SET price=228, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='3755c2da-0661-47bd-bc7b-39dacc016369';  -- "Corte grueso"
UPDATE dishes SET price=204, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='0bd5b5d2-621d-49a1-b047-fa5e0ee5daee';  -- "Grande"
UPDATE dishes SET price=228, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='932e67e5-33d9-4c1c-8f99-5d4bb10d4d24';  -- "Corte grueso"
UPDATE dishes SET price=204, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='fa6ed079-0f10-4378-a9b7-01ada2efe8a1';  -- "Grande"
UPDATE dishes SET price=270, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='0cbedbd7-573f-43e3-ba70-423240f0e4ad';  -- "Corte grueso"
UPDATE dishes SET price=35, is_parent=false, enrichment_status='none', portion_amount=3, portion_unit='pcs' WHERE id='d884fa40-3d20-4b46-92e2-d5ff7c75e66e';  -- "Orden de tres"
UPDATE dishes SET price=35, is_parent=false, enrichment_status='none', portion_amount=3, portion_unit='pcs' WHERE id='d11f444a-effd-4830-bb81-6b176f23da65';  -- "Orden de tres."
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='69b82009-b321-40c9-ab76-926ef7326ecf';  -- "Grande"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='af1541f2-5351-4077-8284-24d413163c52';  -- "Grande"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='fd7a9c51-a87d-4cc1-a1ef-0961b971db87';  -- "Grande"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='b5bb2e89-f349-46e8-bca3-75054f725a87';  -- "Grande"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='cc870f36-856b-45c2-85f4-f3ee74c35fdb';  -- "Grande"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='0c3f3756-da8c-4368-83a4-8a75498da1a6';  -- "Grande"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='17c55db6-ecca-4fc9-8497-b0cf0655d7cd';  -- "Grande"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='53b557e9-964b-430d-a346-1c83a4e84b81';  -- "Grande"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='89b7fb94-375d-4557-93c4-c4ea9bbe60e8';  -- "Grande"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='f7495ea1-9bc7-4f33-8c38-c92502a84f61';  -- "Grande"
UPDATE dishes SET price=175, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='66944426-6e93-45d9-a35c-96cc32f09a88';  -- "Con pechuga de pollo (160g)"
UPDATE dishes SET price=195, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='fe9eb02b-b67a-4b79-8476-57dc513cf1db';  -- "Con pechuga de pollo (160g)"
UPDATE dishes SET price=175, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='7f039c9f-eb88-47dd-9eeb-d676779f4db7';  -- "Con pechuga de pollo (160g)"
UPDATE dishes SET price=175, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='a0d0585b-5231-4706-b869-b8795d0e0edd';  -- "Con pechuga de pollo (160g)"
UPDATE dishes SET price=195, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='4e639375-d098-4f28-bbc0-152344574981';  -- "Con pechuga de pollo (160g)"
UPDATE dishes SET price=175, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='fef50eef-78e1-45a7-97c9-1bc0043fb710';  -- "Con pechuga de pollo (160g)"
UPDATE dishes SET price=195, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='b3b3d5a7-54a6-4730-b35d-7432e55ad781';  -- "Con pechuga de pollo (160g)"
UPDATE dishes SET price=115, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='7374d796-2c87-438b-98f3-ee2e9c7c43fa';  -- "Con pollo"
UPDATE dishes SET price=125, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='50622b8c-7b84-4e54-8c68-f0e694b8564a';  -- "Grande"
UPDATE dishes SET price=145, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='d6556887-a569-46ff-8dc9-c1346ec91d5e';  -- "Grande"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='dc8e5d62-a360-45a5-852a-788d315de396';  -- "Grande"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='37d66baf-305a-4126-9df3-f4462efa0c58';  -- "Grande"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='4d1cd869-efde-4e3a-9d8e-0238ee7994b5';  -- "Grande"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='7fb302af-f643-4c22-8523-9b8310b15681';  -- "Grande"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='2343a21c-7e32-4c58-ad47-e1ff263b7718';  -- "Grande"
UPDATE dishes SET price=245, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='d9b33279-ce57-4af2-9bcb-a3bb826eff3a';  -- "Grande"
UPDATE dishes SET price=225, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='bfb21704-88ff-41ef-a1f1-32b78ac2f554';  -- "Grande"
UPDATE dishes SET price=295, is_parent=false, enrichment_status='none', portion_amount=100, portion_unit='g' WHERE id='e17253db-6b74-43c4-810e-b53f33d68044';  -- "100 gr."
UPDATE dishes SET price=195, is_parent=false, enrichment_status='none', portion_amount=100, portion_unit='g' WHERE id='87fa9771-a15f-4000-8109-354b6c89e13e';  -- "100 gr."
UPDATE dishes SET price=390, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='98af83b9-cb93-47c2-bcdd-089a12370b7f';  -- "Querido Vegano: Pídelas sin parmesano"
UPDATE dishes SET price=160, is_parent=false, enrichment_status='none', portion_amount=8, portion_unit='pcs' WHERE id='101229f5-110c-428b-ab42-9c8873655114';  -- "8 pz"
UPDATE dishes SET price=160, is_parent=false, enrichment_status='none', portion_amount=4, portion_unit='pcs' WHERE id='fe0a92fe-37fd-4b24-9dbe-ef34e044798e';  -- "4 pz"
UPDATE dishes SET price=380, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='4af8eb40-b742-40c6-845a-7e7842e2b225';  -- "GRANDE (4 personas)"
UPDATE dishes SET price=204, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='689f1720-c048-4040-b037-15425618b760';  -- "Grande"
UPDATE dishes SET price=201, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='aee48219-5e75-4615-a546-f1e1eed4bf85';  -- "Corte grueso"
UPDATE dishes SET price=195, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='6f2cf027-f4f1-4b98-b799-91475db0083f';  -- childless
UPDATE dishes SET price=185, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='8337ed58-1f71-4de3-9d44-54f92a27a6a2';  -- childless
UPDATE dishes SET price=195, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='ec3e838c-1f7e-4392-98e6-04cccd2ca868';  -- childless
UPDATE dishes SET price=205, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='9cb44981-56f0-45be-9870-cfc354a441f1';  -- childless
UPDATE dishes SET price=280, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='e38edad5-e628-47a1-91ca-959fa57a06a6';  -- childless
UPDATE dishes SET price=109, is_parent=false, enrichment_status='none', portion_amount=NULL, portion_unit=NULL WHERE id='28316d64-4bda-4ca0-80e6-f251bfcb5a26';  -- childless

-- ===== DELETE folded children (244) =====
DELETE FROM dishes WHERE id IN ('b552a902-c27b-4bd2-9a19-67653355cf4b','a6900662-c3c4-41fd-abcf-69008a45979e','a6b939b0-fc29-4541-825d-53957e7ad905','97537a53-50bd-43be-ba7c-10978ef0a5f9','3becf22c-1db7-4bb7-b1cf-6ddb595ca9c5','35d7860e-8fca-4c39-9c43-112fc119ec5d','23b05a08-67de-437c-a841-247886c23989','6516ea61-4849-406a-a422-bde05add68ca','dca2c1d6-e815-4eca-a553-c0a526dc3ffc','3dc59265-1290-4ce9-b11b-030ebf2a389f','543814c9-fb5f-4a6d-af71-e3e15c7b9d9f','caa45472-d12f-4534-8f27-3d686d80d8e0','4e11dab0-8f08-4dc0-9e3a-b87a9a66797a','92c26963-2a2b-4e67-a83d-75028001d475','7992d561-c890-491d-b8f6-73a54076756f','a2a4b2bd-6f7b-48a7-b216-b6d5ac6aebe9','04c33783-d4dc-454b-9733-2da34612f65e','320d9554-8708-4d5d-87c0-974079c523b5','d19e0fa2-739f-4ee7-8ecc-9b6c7ff50b6c','12f2b2f7-ca2d-4afc-ae38-2ba14fd243f1','218ce807-5389-48d4-8265-19eeeadb1fb7','d856dbdb-ecde-4530-8ffa-2f288b7ee7d4','0beac14c-3de9-472e-af36-951d03cefc9f','b8c2cf9e-e048-4e20-9722-9b094d329c40','77b2e5b1-418c-4db8-bad0-8f084789c626','42f1923f-86da-4bb5-833d-92723883d21a','c1a8bebc-2b5a-4d74-b568-5a9e897562a0','dfa8301e-7b90-4c2a-ba6f-782cb9271000','c3293cef-4980-4635-aa0d-f6f43781de68','09e12c09-4de6-4893-8f57-b3e9194ae40c','826671d8-ca08-4814-9ecf-721871475847','c99b36c0-3019-4b0a-a596-ff41e06ce305','2168c7dd-12a6-4d34-b41a-11a21458f202','4a19d7da-c91a-466f-8ad4-e23dc36a8fc8','33173fe9-5749-4fb6-847b-d2dbbce830ae','da58e524-46bb-4b40-8475-1ccd2f27fda2','6a5e5d03-1505-4754-bf1f-9eb9ebc7a1fe','c0e04a20-4b94-4253-9db4-ded5582f4726','bf16dc0d-d635-4236-94c6-9724c03db9c6','96a973d8-39ec-48de-a425-3d24a0463e1b','6b4b58a8-7723-4cb1-b67d-4fb556106afb','5d654a35-134d-4134-a658-d15bdabe00d8','cd2a6f97-b139-47be-b322-7ac7a107c0fc','b9472afd-cd6f-4cb0-8387-77b0ddb9ef93','0874f503-76d8-4933-87d2-c7583448984a','b7ddfa20-279a-4d22-b8ca-7e66490d663c','ae14748a-7b52-45d7-9d29-13ae0845ec42','547ae178-c44d-40c3-b460-e1718d3edc8e','53b02e80-5bbc-4d4c-aa91-46ed1459568c','80e878bf-f362-49f5-b0ef-81812c1cc7c6');
DELETE FROM dishes WHERE id IN ('f718b36a-d85e-4e55-9d93-adbbb72d864d','89f12868-48ce-4030-9cca-b68215c0b6ad','5448501c-ef4a-488c-9aef-0959eacf3b16','0d3e66db-4cf2-46b9-9438-1a63af04dbfe','1bf5e068-2303-4bf3-8b52-e982f3c54b82','6a972f66-553a-4361-8645-83e3033cd2cb','b947af2b-cb6c-498a-9aef-6f65c498428c','a67f2f00-1b0b-41df-aee4-60b2ebffd6fe','e4a80435-4e17-40cc-800d-70f3b9fff34b','c2b7d2e6-5327-4003-acb8-6dd9130f180f','c12ffb71-4ec0-49a5-9627-e00404308c91','038bae9f-5816-4785-be30-59ad0ec73f57','517d2bc4-6ec5-4324-b484-460f9c437d28','26543645-2163-44c2-9f49-f6b4c56c6ec2','7ca34c8d-def0-40a8-a361-b895163b28bb','8d323d53-fd67-4c6e-b60f-cc4fdd0bf875','8199bef8-0f4a-4ed4-994e-5b45f69f008d','b59003b0-f17d-4338-8966-0f4b6ff18ab5','0e51674c-2ad3-486e-b507-feeb4511ca09','20a4e325-5a28-4bf2-b181-29954ed21c66','452feb48-abb9-4070-9ad4-ec888fe4ccfa','92281bee-6408-4771-9256-e9335fc1c481','a607eb83-6cd1-4a2e-a93f-4380fcb130c6','877226fe-f70d-41cc-8a6c-737bddeb23a8','78cf6abf-04a4-4393-82dc-c390e02644f4','9c47de4f-8659-45a1-a96f-8ffe34a8a936','38045cd0-0f10-4d24-87bf-08ed7178a1db','2296a1ed-6a4b-47c3-9486-0ae907caf6a4','f2e632f3-5d94-4284-a248-8fdcd0a94dd7','4d53236d-8b1c-4322-a56b-37c73a1a1443','cf6b2500-17cf-47c1-8912-129c5f9e6cf3','385c5f45-d8b6-48d7-81de-1a0c702cf718','3b7b7116-ae86-44a2-b447-a6207a5e76c0','991301c3-8ca7-4b99-b680-70bfab8e45a9','95d891af-7662-448e-9719-25e4123ff837','9cb0d47f-dc6c-4aea-85ab-693f40198227','52609242-2226-490e-8fa3-81e35bbc6933','2771701a-a1d1-4883-8a63-09af11019989','c4206ed8-8546-4329-be8d-4b8c9ed87c0d','c32d8c16-06e6-4030-a051-01fccb37a781','2f0c13b0-b88e-4a52-ba97-5da164378b7b','559d5911-2c1b-4495-91b2-3c99c1ffcd01','c5e7a33e-e7c1-4fb0-8380-146538e84f5d','07890d2e-866e-4c49-b2b4-010a544dd015','b14bdf96-a297-4c11-94e7-0256c683cfaa','ce2b2a93-69b7-4e48-a041-53f34e836bba','0becaf54-2239-4b5d-adc1-ae2b5c497fdb','48e41c26-c156-4358-9d89-85331eaa7712','86fa51d1-a6be-4556-90fc-a1ec1030a495','afc4bd7f-34e0-40ad-8b8c-fe84a93e8715');
DELETE FROM dishes WHERE id IN ('fb15b74f-1299-480e-a7aa-67b5a7ae2724','89aee064-105f-476e-b4ce-05f311d65ff6','587f73d8-4996-41bf-a1a3-06c32180b3b5','5efd5605-eb13-4a75-b7d8-08c2bdfad691','9760c498-a02f-4ca5-a94c-3d39a21fa091','bf466a2f-07fa-4cd3-af5a-8f06cd4f56ce','2a6ab452-ebf5-41f4-873b-04e5b1b756b9','64a0c6ed-4ec0-46c6-8c05-1c650c3f9682','978ba57c-aefc-4c7e-9670-9a071770de27','1f6ca1f9-330b-4a53-ac30-a35f45b33c00','6ece4a0e-adf4-407f-9a48-e83b8f824717','8c7ca917-c611-4578-bf95-a4e68879d871','70707063-43f1-40c9-a272-0836c83d918f','ab12166f-95ca-470f-832b-c54572d0d504','c9d3f700-f4be-4c8a-9b17-b12c21e38078','88749888-69cb-4a54-a57d-d5f8285275b5','4aa7c3e4-5050-47af-b7da-ec5fb47d53d8','0e493f71-b119-43c6-b624-622957287b23','d221e803-b8ca-4102-bd2f-ba866f1abc65','6af60c87-725f-4cb9-97d1-93356910a442','65592d9c-052e-44f6-b0e3-ef3eef97b88d','3e73c43d-8c03-44d6-b718-b32095836056','2d399d6b-74c6-47de-9306-8a6774ded621','fcb6bcde-077a-45f7-ae13-4d1d29fd87d1','cd25c444-fdcd-4cb7-a589-43b7b6004fc1','e1e73ea9-ff57-4eff-b929-a05edd1463e4','8c4e9c68-ca37-4b7f-b759-2a34988dd880','8e15e2b9-6966-4a93-a20f-827808aa2356','19b7c125-bcfb-4051-8e01-3ffaebb29609','be3e3052-3d74-4b7f-949f-e73c164f1bfd','7026bad8-e586-42b9-85eb-afe745f11568','3799cdf8-bd86-4415-9c9f-dcc5c613cee0','4c194753-7d29-4d52-aef8-b96157df73b8','2296813b-bd84-4b66-897a-409a2e8e6b61','378077d3-7e48-4828-ab96-8006e28053de','83f554f7-2f72-4d4c-9e15-401cee93f16a','8469830e-16e3-4e1a-bfac-420ec86eb1f9','bc3e4c3f-6d6a-466c-b0b7-e9ef9c5139c6','ed419316-f968-4310-9f0c-ce46eaadd62d','20b0f732-8fae-4a55-9aa1-070ac95dbca6','2c9d0d91-f3a6-47c9-9c97-c4d643bd526d','2be4160b-1e9a-4949-b13c-0c16384e1414','b2ef2dd5-86e0-4b7f-afa9-0735d93dfd97','1031d4c2-a801-425b-8ceb-59fcafade913','1e655349-782b-4552-8d7b-cdb3c1dd7f91','605e809d-af29-4967-a683-979a42ea0799','381b3012-6fe6-4dd4-885a-b8175f0ffa55','ada85450-2a24-42e3-af1b-edc7e47df4db','cfd62c23-7ee0-44b2-8a8b-deb0fd71fe93','43f560c7-c081-45e7-9dae-d5a2bdab91df');
DELETE FROM dishes WHERE id IN ('02312f2b-b433-4a7e-9605-73e6555c24f9','b8d5a229-9eb9-4056-a27e-7a6f0f232da7','01a790da-92b2-4f44-a386-aa036455d555','0ed5e737-8c85-44cc-8bee-db7e36c2a949','8c2b41da-365b-42f5-bf2c-b55f19dcfddb','88c4ceed-611e-407b-81a5-0139d78f1b1b','f83a12bc-075c-4789-8681-bff0ae80347f','2142e6b0-37e2-48c4-8b04-1394e36626e3','0c0c2d6c-7ab2-4c06-9b71-707eba2a16c8','be52d2f6-e33e-4576-9046-bcc6fb44e558','b30f4179-e44c-4840-b081-58c294394c3e','1bd4938d-e139-4f78-b693-ab9605003ed6','5c0d073e-5ab9-485b-bef1-8377b8f82035','29b3b495-c831-4fad-a51d-78b17deb6813','ea8c0ded-800b-4133-9719-092bc6473806','e9f57978-03e4-4a4a-99b9-839a43138cda','ea60015c-a2b2-4e9c-9fbb-9c2723f0ca7a','48767908-b1bd-4810-8ad6-75e3c153ad4c','d0a4bc23-a2b5-421d-9380-d2880fbe460f','6084f773-9a8f-40c7-8b92-ce7e21e1eaec','79d068ab-2307-44a3-884a-a22bfbe4700a','42d207fc-445b-465c-bd5f-bc0bffc65e59','702abf8e-c2d3-43fe-ab9b-2680b505170a','37c0a7ef-c250-4086-8cd8-3389afe83993','e1e40561-f1f9-4a4b-9733-9c6e0d8e57ec','67888f9a-dc6e-46dc-a0ea-f962aa2b0045','a8a37778-ea43-408c-bc11-8fd0b4e26c43','5577f3cf-60ca-4090-ac40-86612b0588f9','815119e0-fc43-4c21-b4c6-da4530bdf20e','31a3ed3b-1b2c-497f-b34e-ac1eb9a9149b','fd310436-248c-4768-bbf6-5692ea140b0a','a234fe49-e96d-427b-8966-7585b2454a06','81cb459e-4cb9-4643-9a43-d57a850f3ebc','9756775d-3c80-4370-a0f1-9dc4b6b4ebb9','0357f028-08d8-4cd9-b1e6-3716edf3665a','f559ac37-66d4-493f-873b-7915638c6c83','a6047bc7-e995-4d40-ab34-46e5a0b30daa','a86d9ce6-e917-4371-bdba-bcb98fcfd8e5','c246204d-94d6-4393-9844-ed7712effe79','4197ba29-61b9-47c1-8f58-816c3bcadbeb','3093e8e7-5329-4307-b910-2b2333aec598','cc785f55-07cf-4797-93c0-8e3627562840','1ff3235d-a560-4fa0-8114-b04e5c3be6c9','8f8ef216-bbe7-496e-b4d3-252353d8469f','1f56977e-cf4b-4c40-8e62-9b76102b46ba','05013798-03ab-48ab-907a-79ee295c9b6f','0b22682d-0433-486e-8819-6116c64c31da','2faf5482-e741-4a13-af5b-5fe5ff8a3218','3562c505-986e-4411-9ce3-1f66352a887b','063e8863-de1f-4186-b025-e103655209b1');
DELETE FROM dishes WHERE id IN ('4aa19aeb-afeb-4ab8-852d-8baa67645806','83e51309-89fb-4be2-810b-fd8a59cba319','73442071-b85f-4af4-b96f-40012d36cd0d','fd1e9012-c558-4a4d-8f1e-d39692e530ab','deb4f372-00af-4809-91c9-3615a87decde','923b5600-d275-482e-87ad-058f300f1258','9d7fe0f5-8d31-4806-92ac-0b98f5a57b22','83ca4716-ff1f-4760-8df6-ff6125018549','a3db3da6-e5dd-4969-a2d9-e194d5cc1995','0b571a6b-ae16-4f6d-a694-f230490b3e6b','054a7723-2b07-440c-aded-e6cd8283044d','86e68b59-6d09-45f0-a4c4-0c14faa3be3c','f41275d6-0578-44f5-ad23-02d45db7b407','e610be43-992e-4503-bbd2-3739327135d4','91ce41d5-e3b7-40ab-a0d2-e0322c8a023c','684204b8-9c64-4863-92ea-fb3eddd51145','ceae7255-58c8-49e1-853e-2a8af166fa8a','6d5fef96-e7b6-43c6-b9c8-32823cb51864','920e2e3f-ac5b-47d5-bd80-6fed3147eb62','f5fce1dd-67bb-4326-9a49-373feacb6d81','a426c542-3dfe-4afd-8a42-90ac6ee0ad81','349333f1-185c-47f3-a6eb-3e975cd2cd80','60c7a716-66e2-4661-b481-151f058741b7','ddd9e72f-69f5-46a6-9232-4bd177462053','19f9cf58-b0df-4807-b125-639746ad32e0','381074c6-9113-4360-86da-f09f99c4170b','784da3f1-2fd4-4612-a845-44cf36335c6d','074cc89d-c6bd-40f0-ad26-72ea4ebb8fed','3cbefcc8-4a1c-4dc7-b2fb-b3cb2952bc44','131052de-b154-4de7-8090-09f08b016843','c6593ced-3812-4dc6-94a3-36d81ed2f378','c69590a6-89b6-4294-8705-bd610915b640','fd679751-5f08-4c04-bdf4-d5c512c13936','718b7309-c30b-4062-ad58-a9f3bcd3c842','2e321fa8-eb6c-4242-a2d1-dd89f7535cdc','f3e09c5f-0652-4597-8539-8cb4bb0cbf53','c0228346-bde8-42a5-878d-bf3212c84371','f564a599-0947-4e35-b366-4884c186b58a','3ddab5e3-53db-40dc-9dcb-20edc3a54acb','0d60cea2-d0ef-44e0-988d-c1e2b58faba6','ba6d8085-e5f2-4f1a-8fce-bcbdbecf7852','e190e861-baf5-4c00-b306-ad0452532dec','398afc01-ac05-480c-96f8-f7402b9daef7','709b691f-bf8e-4174-8116-b4c2f37ec62b');

-- Expected after apply: option_groups 434, options 1775, dishes 5754, is_parent 0.

-- ===== OPERATOR FLAG LIST — 51 single-child price discrepancies (>25%); kept the menu price =====
--   ENSALADA CESAR: kept $240, variant "+ pechuga de pollo 120 g" was $50
--   Chicken Ramen: kept $204, variant "Grande" was $260
--   Atún: kept $179, variant "Corte grueso" was $261
--   Pulpo: kept $201, variant "Corte grueso" was $276
--   Robalo: kept $201, variant "Corte grueso" was $276
--   SALAME: kept $225, variant "Grande" was $285
--   Chorizo ibérico de bellota: kept $195, variant "100 gr." was $295
--   Jamón ibérico de bellota 50%: kept $350, variant "100 gr." was $690
--   Ensalada de tomate orgánico con ventresca de bonito: kept $450, variant "Querido Vegano: Pídela sin ventresca" was $190
--   Ensaladilla rusa clásica con camarones y atún: kept $190, variant "1 rac" was $350
--   Boquerones en vinagre ajo y perejil: kept $190, variant "10 uds" was $330
--   Flores de calabaza en tempura rellenas de queso trufado: kept $160, variant "1 rac" was $290
--   ALITAS: kept $189, variant "25 piezas incluye 2 aderezos 3 salsas a elegir" was $369
--   Salmón Ahumado: kept $228, variant "Corte grueso" was $298
--   Salmon Ramen: kept $204, variant "Grande" was $260
--   Mixto: kept $228, variant "Corte grueso" was $353
--   Ramen Chashu: kept $204, variant "Grande" was $260
--   Mixto Especial: kept $270, variant "Corte grueso" was $353
--   Tacos de Cochinita: kept $35, variant "Orden de tres" was $75
--   Sopes de Cochinita: kept $35, variant "Orden de tres." was $95
--   DEL MUERTO: kept $225, variant "Grande" was $285
--   DONATELLO: kept $225, variant "Grande" was $285
--   ELBA ESTHER: kept $225, variant "Grande" was $285
--   LYN MAY: kept $225, variant "Grande" was $285
--   MARGHERITA: kept $225, variant "Grande" was $285
--   NOA NOA: kept $225, variant "Grande" was $285
--   PIRI: kept $225, variant "Grande" was $285
--   POPEYE: kept $225, variant "Grande" was $285
--   PROSCIUTTO E FUNGHI: kept $225, variant "Grande" was $285
--   TRAVIESA: kept $225, variant "Grande" was $285
--   Fusilli Arrabiata: kept $175, variant "Con pechuga de pollo (160g)" was $235
--   Spaghetti Aglio Olio: kept $175, variant "Con pechuga de pollo (160g)" was $235
--   SPAGHETTI AL BURRO: kept $175, variant "Con pechuga de pollo (160g)" was $235
--   Fetuccini Alfredo: kept $195, variant "Con pechuga de pollo (160g)" was $255
--   FETUCCINI NAPOLITANA: kept $175, variant "Con pechuga de pollo (160g)" was $235
--   FUSILLI AL PESTO: kept $195, variant "Con pechuga de pollo (160g)" was $255
--   ENSALADA CÉSAR: kept $115, variant "Con pollo" was $205
--   ENSALADA QUASI: kept $125, variant "Grande" was $165
--   AZTECA: kept $225, variant "Grande" was $285
--   DI PERA E GORGONZOLA: kept $225, variant "Grande" was $285
--   PEPPERONI: kept $225, variant "Grande" was $285
--   PIZZA AL PASTOR: kept $225, variant "Grande" was $284.99
--   QUATTRO FORMAGGI: kept $225, variant "Grande" was $285
--   VEGETARIANA: kept $225, variant "Grande" was $285
--   Queso manchego curado reserva 6 meses: kept $295, variant "100 gr." was $440
--   Salchichón ibérico de bellota: kept $195, variant "100 gr." was $295
--   Croquetas de jamón serrano: kept $160, variant "8 pz" was $290
--   Tacos de lechón, piña y chipotle: kept $160, variant "4 pz" was $260
--   Cubo de helado de pistache salado con toppings: kept $380, variant "GRANDE (4 personas)" was $760
--   Spicy Miso Ramen Beef: kept $204, variant "Grande" was $260
--   Salmón: kept $201, variant "Corte grueso" was $276

COMMIT;