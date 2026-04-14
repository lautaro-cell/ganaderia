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
INSERT INTO "Users" ("Id","Email","TenantId","Role","PasswordHash","CreatedAt")
VALUES 
(gen_random_uuid(),'admin@ombu.com','11111111-1111-1111-1111-111111111111',1,'$2a$11$mH/hXlX2M/vN6vYc6uS2uevW.3rW9oH/6oR1.a8uK4XQ5pG3O6E6e',now()),
(gen_random_uuid(),'admin@ganaderia.com','11111111-1111-1111-1111-111111111111',1,'$2a$11$mH/hXlX2M/vN6vYc6uS2uevW.3rW9oH/6oR1.a8uK4XQ5pG3O6E6e',now()),
(gen_random_uuid(),'oper@ombu.com','11111111-1111-1111-1111-111111111111',0,'$2a$11$mH/hXlX2M/vN6vYc6uS2uevW.3rW9oH/6oR1.a8uK4XQ5pG3O6E6e',now()),
(gen_random_uuid(),'admin@sanmarcos.com','22222222-2222-2222-2222-222222222222',1,'$2a$11$mH/hXlX2M/vN6vYc6uS2uevW.3rW9oH/6oR1.a8uK4XQ5pG3O6E6e',now()),
(gen_random_uuid(),'admin@laslilas.com','33333333-3333-3333-3333-333333333333',1,'$2a$11$mH/hXlX2M/vN6vYc6uS2uevW.3rW9oH/6oR1.a8uK4XQ5pG3O6E6e',now());

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
-- FIELDS
-- =====================================================
-- Estancia El Ombú
INSERT INTO "Fields" ("Id","Name","IsActive","TenantId","CreatedAt")
VALUES 
('f1111111-1111-1111-1111-111111111111','Campo Grande',true,'11111111-1111-1111-1111-111111111111',now()),
('f1111111-1111-1111-1111-111111111112','Puesto Sur',true,'11111111-1111-1111-1111-111111111111',now());

-- Cabaña San Marcos
INSERT INTO "Fields" ("Id","Name","IsActive","TenantId","CreatedAt")
VALUES 
('f2222222-2222-2222-2222-222222222221','Centro Genético',true,'22222222-2222-2222-2222-222222222222',now());

-- =====================================================
-- ANIMAL CATEGORIES
-- =====================================================
INSERT INTO "AnimalCategories" ("Id","Name","ActivityId","TenantId","StandardWeightKg","IsActive","Type","CreatedAt")
VALUES
-- El Ombú
('c1111111-1111-1111-1111-111111111111','Ternero','a1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111',160,true,0,now()),
('c1111111-1111-1111-1111-111111111112','Vaca con Cría','a1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111',450,true,0,now()),
('c1111111-1111-1111-1111-111111111113','Novillo Recría','a1111111-1111-1111-1111-111111111112','11111111-1111-1111-1111-111111111111',320,true,0,now()),
-- San Marcos
('c2222222-2222-2222-2222-222222222221','Toro Puro de Pedigree','a2222222-2222-2222-2222-222222222221','22222222-2222-2222-2222-222222222222',850,true,0,now()),
('c2222222-2222-2222-2222-222222222222','Vaquillona Elite','a2222222-2222-2222-2222-222222222221','22222222-2222-2222-2222-222222222222',400,true,0,now());

-- =====================================================
-- EVENT TEMPLATES
-- =====================================================
INSERT INTO "EventTemplates" ("Id","TenantId","Name","EventType","DebitAccountCode","CreditAccountCode","IsActive","CreatedAt")
VALUES
('e1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','Marcación / Nacimiento',1,'1110','4110',true,now()),
('e1111111-1111-1111-1111-111111111112','11111111-1111-1111-1111-111111111111','Pesaje de Control',2,'1110','1110',true,now()),
('e2222222-2222-2222-2222-222222222221','22222222-2222-2222-2222-222222222222','Inseminación',3,'5110','2110',true,now());

-- =====================================================
-- LIVESTOCK EVENTS (Historical & Current)
-- =====================================================
-- Tenant 1: El Ombú
INSERT INTO "LivestockEvents" ("Id","TenantId","EventTemplateId","CostCenterCode","FieldId","ActivityId","CategoryId","HeadCount","EstimatedWeightKg","WeightPerHead","TotalAmount","EventDate","Status","CreatedAt")
VALUES
(gen_random_uuid(),'11111111-1111-1111-1111-111111111111','e1111111-1111-1111-1111-111111111111','CC-OMBU-01','f1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111',50,8000,160,5000000,now() - interval '3 months',3,now()),
(gen_random_uuid(),'11111111-1111-1111-1111-111111111111','e1111111-1111-1111-1111-111111111111','CC-OMBU-01','f1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111',45,7200,160,4500000,now() - interval '2 months',3,now()),
(gen_random_uuid(),'11111111-1111-1111-1111-111111111111','e1111111-1111-1111-1111-111111111112','CC-OMBU-01','f1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111',95,19000,200,0,now() - interval '1 week',0,now()),
-- Otro registro de El Ombú
(gen_random_uuid(),'11111111-1111-1111-1111-111111111111','e1111111-1111-1111-1111-111111111112','CC-OMBU-02','f1111111-1111-1111-1111-111111111112','a1111111-1111-1111-1111-111111111112','c1111111-1111-1111-1111-111111111113',120,42000,350,0,now() - interval '1 month',1,now());

-- Tenant 2: San Marcos
INSERT INTO "LivestockEvents" ("Id","TenantId","EventTemplateId","CostCenterCode","FieldId","ActivityId","CategoryId","HeadCount","EstimatedWeightKg","WeightPerHead","TotalAmount","EventDate","Status","CreatedAt")
VALUES
(gen_random_uuid(),'22222222-2222-2222-2222-222222222222','e2222222-2222-2222-2222-222222222221','CC-GEN-01','f2222222-2222-2222-2222-222222222221','a2222222-2222-2222-2222-222222222221','c2222222-2222-2222-2222-222222222222',15,0,0,150000,now() - interval '15 days',1,now());

-- =====================================================
-- EXTERNAL CATALOGS & CONFIG
-- =====================================================
INSERT INTO "ExternalCatalogs" ("Id","TenantId","CatalogType","Data","LastSyncedAt","CreatedAt")
VALUES
(gen_random_uuid(),'11111111-1111-1111-1111-111111111111',1,'{"Accounts":[{"Code":"1110","Name":"Hacienda Vacuna"},{"Code":"4110","Name":"Ventas Hacienda"}]}',now(),now());

INSERT INTO "GestorMaxConfigs" ("Id","TenantId","GestorDatabaseId","ApiKeyEncrypted","ApiKeyLast4","BaseUrl","IsEnabled","CreatedAt")
VALUES
(gen_random_uuid(),'11111111-1111-1111-1111-111111111111',101,'ENCRYPTED_SECRET','0987','https://api.gestormax.com/v1',true,now());
