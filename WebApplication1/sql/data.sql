-- =====================================================
-- TENANTS (3 Distintos modelos de negocio)
-- =====================================================
INSERT INTO "Tenants" ("Id","Name","ErpTenantId","CreatedAt")
VALUES 
('11111111-1111-1111-1111-111111111111','Estancia El Ombú (Cría)','OMBU-001',now()),
('22222222-2222-2222-2222-222222222222','Cabaña San Marcos (Cabaña)','MARCOS-002',now()),
('33333333-3333-3333-3333-333333333333','Feedlot Las Lilas (Engorde)','LILAS-003',now());

-- =====================================================
-- USERS
-- =====================================================
INSERT INTO "Users" ("Id","Email","TenantId","Role","CreatedAt")
VALUES 
(gen_random_uuid(),'admin@ombu.com','11111111-1111-1111-1111-111111111111',1,now()),
(gen_random_uuid(),'oper@ombu.com','11111111-1111-1111-1111-111111111111',0,now()),
(gen_random_uuid(),'admin@sanmarcos.com','22222222-2222-2222-2222-222222222222',1,now()),
(gen_random_uuid(),'admin@laslilas.com','33333333-3333-3333-3333-333333333333',1,now());

-- =====================================================
-- ACTIVITIES
-- =====================================================
INSERT INTO "Activities" ("Id","Name","TenantId","CreatedAt","IsGlobal")
VALUES 
('a1111111-1111-1111-1111-111111111111','Cría','11111111-1111-1111-1111-111111111111',now(),false),
('a1111111-1111-1111-1111-111111111112','Recría','11111111-1111-1111-1111-111111111111',now(),false),
('a2222222-2222-2222-2222-222222222221','Cabaña (Genética)','22222222-2222-2222-2222-222222222222',now(),false),
('a3333333-3333-3333-3333-333333333331','Engorde a Corral','33333333-3333-3333-3333-333333333333',now(),false);

-- =====================================================
-- FIELDS & LOTES
-- =====================================================
-- Estancia El Ombú
INSERT INTO "Fields" ("Id","Name","IsActive","TenantId","CreatedAt")
VALUES 
('f1111111-1111-1111-1111-111111111111','Campo Grande',true,'11111111-1111-1111-1111-111111111111',now()),
('f1111111-1111-1111-1111-111111111112','Puesto Sur',true,'11111111-1111-1111-1111-111111111111',now());

INSERT INTO "Lotes" ("Id","Name","TenantId","FieldId","CreatedAt")
VALUES 
('l1111111-1111-1111-1111-111111111111','Lote A (Los Pinos)','11111111-1111-1111-1111-111111111111','f1111111-1111-1111-1111-111111111111',now()),
('l1111111-1111-1111-1111-111111111112','Lote B (Bañadero)','11111111-1111-1111-1111-111111111111','f1111111-1111-1111-1111-111111111111',now());

-- Cabaña San Marcos
INSERT INTO "Fields" ("Id","Name","IsActive","TenantId","CreatedAt")
VALUES 
('f2222222-2222-2222-2222-222222222221','Centro Genético',true,'22222222-2222-2222-2222-222222222222',now());

INSERT INTO "Lotes" ("Id","Name","TenantId","FieldId","CreatedAt")
VALUES 
('l2222222-2222-2222-2222-222222222221','Corrales Premium','22222222-2222-2222-2222-222222222222','f2222222-2222-2222-2222-222222222221',now());

-- ActivityLote mapping
INSERT INTO "ActivityLote" ("ActivitiesId","LoteId")
VALUES 
('a1111111-1111-1111-1111-111111111111','l1111111-1111-1111-1111-111111111111'),
('a1111111-1111-1111-1111-111111111112','l1111111-1111-1111-1111-111111111112'),
('a2222222-2222-2222-2222-222222222221','l2222222-2222-2222-2222-222222222221'),
('a3333333-3333-3333-3333-333333333331','l2222222-2222-2222-2222-222222222221');

-- =====================================================
-- ANIMAL CATEGORIES
-- =====================================================
INSERT INTO "AnimalCategories" ("Id","Name","ActivityId","TenantId","StandardWeightKg","IsActive","Type","CreatedAt")
VALUES
-- El Ombú
('c111-111','Ternero','a1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111',160,true,1,now()),
('c111-112','Vaca con Cría','a1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111',450,true,1,now()),
('c111-113','Novillo Recría','a1111111-1111-1111-1111-111111111112','11111111-1111-1111-1111-111111111111',320,true,1,now()),
-- San Marcos
('c222-221','Toro Puro de Pedigree','a2222222-2222-2222-2222-222222222221','22222222-2222-2222-2222-222222222222',850,true,1,now()),
('c222-222','Vaquillona Elite','a2222222-2222-2222-2222-222222222221','22222222-2222-2222-2222-222222222222',400,true,1,now());

-- =====================================================
-- EVENT TEMPLATES
-- =====================================================
INSERT INTO "EventTemplates" ("Id","TenantId","Name","EventType","DebitAccountCode","CreditAccountCode","IsActive","CreatedAt")
VALUES
('t111-001','11111111-1111-1111-1111-111111111111','Marcación / Nacimiento',1,'1110','4110',true,now()),
('t111-002','11111111-1111-1111-1111-111111111111','Pesaje de Control',2,'1110','1110',true,now()),
('t222-001','22222222-2222-2222-2222-222222222222','Inseminación',3,'5110','2110',true,now());

-- =====================================================
-- LIVESTOCK EVENTS (Historical & Current)
-- =====================================================
-- Tenant 1: El Ombú
INSERT INTO "LivestockEvents" ("Id","TenantId","EventTemplateId","CostCenterCode","FieldId","LoteId","ActivityId","CategoryId","HeadCount","EstimatedWeightKg","WeightPerHead","TotalAmount","EventDate","Status","CreatedAt")
VALUES
(gen_random_uuid(),'11111111-1111-1111-1111-111111111111','t111-001','CC-OMBU-01','f1111111-1111-1111-1111-111111111111','l1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','c111-111',50,8000,160,5000000,now() - interval '3 months',3,now()),
(gen_random_uuid(),'11111111-1111-1111-1111-111111111111','t111-001','CC-OMBU-01','f1111111-1111-1111-1111-111111111111','l1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','c111-111',45,7200,160,4500000,now() - interval '2 months',3,now()),
(gen_random_uuid(),'11111111-1111-1111-1111-111111111111','t111-002','CC-OMBU-01','f1111111-1111-1111-1111-111111111111','l1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','c111-111',95,19000,200,0,now() - interval '1 week',0,now()),
-- Otro lote de El Ombú
(gen_random_uuid(),'11111111-1111-1111-1111-111111111111','t111-002','CC-OMBU-02','f1111111-1111-1111-1111-111111111112','l1111111-1111-1111-1111-111111111112','a1111111-1111-1111-1111-111111111112','c111-113',120,42000,350,0,now() - interval '1 month',1,now());

-- Tenant 2: San Marcos
INSERT INTO "LivestockEvents" ("Id","TenantId","EventTemplateId","CostCenterCode","FieldId","LoteId","ActivityId","CategoryId","HeadCount","EstimatedWeightKg","WeightPerHead","TotalAmount","EventDate","Status","CreatedAt")
VALUES
(gen_random_uuid(),'22222222-2222-2222-2222-222222222222','t222-001','CC-GEN-01','f2222222-2222-2222-2222-222222222221','l2222222-2222-2222-2222-222222222221','a2222222-2222-2222-2222-222222222221','c222-222',15,0,0,150000,now() - interval '15 days',1,now());

-- =====================================================
-- EXTERNAL CATALOGS & CONFIG
-- =====================================================
INSERT INTO "ExternalCatalogs" ("Id","TenantId","CatalogType","Data","LastSyncedAt","CreatedAt")
VALUES
(gen_random_uuid(),'11111111-1111-1111-1111-111111111111',1,'{"Accounts":[{"Code":"1110","Name":"Hacienda Vacuna"},{"Code":"4110","Name":"Ventas Hacienda"}]}',now(),now());

INSERT INTO "GestorMaxConfigs" ("Id","TenantId","GestorDatabaseId","ApiKeyEncrypted","ApiKeyLast4","BaseUrl","IsEnabled","CreatedAt")
VALUES
(gen_random_uuid(),'11111111-1111-1111-1111-111111111111',101,'ENCRYPTED_SECRET','0987','https://api.gestormax.com/v1',true,now());