
CREATE TABLE public."AccountingDrafts" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "LivestockEventId" uuid NOT NULL,
    "AccountCode" text NOT NULL,
    "Concept" text NOT NULL,
    "DebitAmount" numeric(18,2) NOT NULL,
    "CreditAmount" numeric(18,2) NOT NULL,
    "EntryType" text NOT NULL,
    "HeadCount" integer NOT NULL,
    "WeightKg" numeric(12,2),
    "WeightPerHead" numeric(10,2),
    "FieldId" uuid,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text
);


ALTER TABLE public."AccountingDrafts" OWNER TO postgres;

--
-- Name: Activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Activities" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "TenantId" uuid,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "IsGlobal" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."Activities" OWNER TO postgres;

--
-- Name: ActivityLote; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ActivityLote" (
    "ActivitiesId" uuid NOT NULL,
    "LoteId" uuid NOT NULL
);


ALTER TABLE public."ActivityLote" OWNER TO postgres;

--
-- Name: AnimalCategories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AnimalCategories" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "ActivityId" uuid NOT NULL,
    "TenantId" uuid,
    "StandardWeightKg" numeric(10,2),
    "IsActive" boolean NOT NULL,
    "Type" integer NOT NULL,
    "ExternalId" text,
    "LastSyncedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text
);


ALTER TABLE public."AnimalCategories" OWNER TO postgres;

--
-- Name: EventTemplates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."EventTemplates" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "Name" text NOT NULL,
    "EventType" integer NOT NULL,
    "DebitAccountCode" text NOT NULL,
    "CreditAccountCode" text NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text
);


ALTER TABLE public."EventTemplates" OWNER TO postgres;

--
-- Name: ExternalCatalogs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ExternalCatalogs" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "CatalogType" integer NOT NULL,
    "Data" jsonb,
    "LastSyncedAt" timestamp with time zone NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text
);


ALTER TABLE public."ExternalCatalogs" OWNER TO postgres;

--
-- Name: Fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Fields" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "Description" text,
    "IsActive" boolean NOT NULL,
    "TenantId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text
);


ALTER TABLE public."Fields" OWNER TO postgres;

--
-- Name: GestorMaxConfigs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."GestorMaxConfigs" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "GestorDatabaseId" integer NOT NULL,
    "ApiKeyEncrypted" text NOT NULL,
    "ApiKeyLast4" text NOT NULL,
    "BaseUrl" text NOT NULL,
    "IsEnabled" boolean NOT NULL,
    "LastTestedAt" timestamp with time zone,
    "LastTestOk" boolean,
    "LastTestError" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text
);


ALTER TABLE public."GestorMaxConfigs" OWNER TO postgres;

--
-- Name: LivestockEvents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LivestockEvents" (
    "Id" uuid NOT NULL,
    "TenantId" uuid NOT NULL,
    "EventTemplateId" uuid NOT NULL,
    "CostCenterCode" text NOT NULL,
    "FieldId" uuid,
    "ActivityId" uuid,
    "CategoryId" uuid,
    "HeadCount" integer NOT NULL,
    "EstimatedWeightKg" numeric(12,2) NOT NULL,
    "WeightPerHead" numeric(10,2),
    "TotalAmount" numeric(18,2) NOT NULL,
    "EventDate" timestamp with time zone NOT NULL,
    "Status" integer NOT NULL,
    "ErpTransactionId" text,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text,
    "LoteId" uuid,
    "Observations" text
);


ALTER TABLE public."LivestockEvents" OWNER TO postgres;

--
-- Name: Lotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Lotes" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "TenantId" uuid NOT NULL,
    "FieldId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text
);


ALTER TABLE public."Lotes" OWNER TO postgres;

--
-- Name: Tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Tenants" (
    "Id" uuid NOT NULL,
    "Name" text NOT NULL,
    "ErpTenantId" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text
);


ALTER TABLE public."Tenants" OWNER TO postgres;

--
-- Name: Users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Users" (
    "Id" uuid NOT NULL,
    "Email" text NOT NULL,
    "TenantId" uuid NOT NULL,
    "Role" integer NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" text,
    "UpdatedAt" timestamp with time zone,
    "UpdatedBy" text
);


ALTER TABLE public."Users" OWNER TO postgres;

--
-- Name: __EFMigrationsHistory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL
);


ALTER TABLE public."__EFMigrationsHistory" OWNER TO postgres;

--
-- Name: AccountingDrafts PK_AccountingDrafts; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountingDrafts"
    ADD CONSTRAINT "PK_AccountingDrafts" PRIMARY KEY ("Id");


--
-- Name: Activities PK_Activities; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Activities"
    ADD CONSTRAINT "PK_Activities" PRIMARY KEY ("Id");


--
-- Name: ActivityLote PK_ActivityLote; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ActivityLote"
    ADD CONSTRAINT "PK_ActivityLote" PRIMARY KEY ("ActivitiesId", "LoteId");


--
-- Name: AnimalCategories PK_AnimalCategories; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AnimalCategories"
    ADD CONSTRAINT "PK_AnimalCategories" PRIMARY KEY ("Id");


--
-- Name: EventTemplates PK_EventTemplates; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EventTemplates"
    ADD CONSTRAINT "PK_EventTemplates" PRIMARY KEY ("Id");


--
-- Name: ExternalCatalogs PK_ExternalCatalogs; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExternalCatalogs"
    ADD CONSTRAINT "PK_ExternalCatalogs" PRIMARY KEY ("Id");


--
-- Name: Fields PK_Fields; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Fields"
    ADD CONSTRAINT "PK_Fields" PRIMARY KEY ("Id");


--
-- Name: GestorMaxConfigs PK_GestorMaxConfigs; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."GestorMaxConfigs"
    ADD CONSTRAINT "PK_GestorMaxConfigs" PRIMARY KEY ("Id");


--
-- Name: LivestockEvents PK_LivestockEvents; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LivestockEvents"
    ADD CONSTRAINT "PK_LivestockEvents" PRIMARY KEY ("Id");


--
-- Name: Lotes PK_Lotes; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Lotes"
    ADD CONSTRAINT "PK_Lotes" PRIMARY KEY ("Id");


--
-- Name: Tenants PK_Tenants; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Tenants"
    ADD CONSTRAINT "PK_Tenants" PRIMARY KEY ("Id");


--
-- Name: Users PK_Users; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Users"
    ADD CONSTRAINT "PK_Users" PRIMARY KEY ("Id");


--
-- Name: __EFMigrationsHistory PK___EFMigrationsHistory; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."__EFMigrationsHistory"
    ADD CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId");


--
-- Name: IX_AccountingDrafts_LivestockEventId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_AccountingDrafts_LivestockEventId" ON public."AccountingDrafts" USING btree ("LivestockEventId");


--
-- Name: IX_AccountingDrafts_TenantId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_AccountingDrafts_TenantId" ON public."AccountingDrafts" USING btree ("TenantId");


--
-- Name: IX_Activities_TenantId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_Activities_TenantId" ON public."Activities" USING btree ("TenantId");


--
-- Name: IX_ActivityLote_LoteId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_ActivityLote_LoteId" ON public."ActivityLote" USING btree ("LoteId");


--
-- Name: IX_AnimalCategories_ActivityId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_AnimalCategories_ActivityId" ON public."AnimalCategories" USING btree ("ActivityId");


--
-- Name: IX_AnimalCategories_TenantId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_AnimalCategories_TenantId" ON public."AnimalCategories" USING btree ("TenantId");


--
-- Name: IX_EventTemplates_TenantId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_EventTemplates_TenantId" ON public."EventTemplates" USING btree ("TenantId");


--
-- Name: IX_ExternalCatalogs_TenantId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_ExternalCatalogs_TenantId" ON public."ExternalCatalogs" USING btree ("TenantId");


--
-- Name: IX_Fields_TenantId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_Fields_TenantId" ON public."Fields" USING btree ("TenantId");


--
-- Name: IX_GestorMaxConfigs_TenantId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_GestorMaxConfigs_TenantId" ON public."GestorMaxConfigs" USING btree ("TenantId");


--
-- Name: IX_LivestockEvents_ActivityId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_LivestockEvents_ActivityId" ON public."LivestockEvents" USING btree ("ActivityId");


--
-- Name: IX_LivestockEvents_CategoryId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_LivestockEvents_CategoryId" ON public."LivestockEvents" USING btree ("CategoryId");


--
-- Name: IX_LivestockEvents_EventTemplateId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_LivestockEvents_EventTemplateId" ON public."LivestockEvents" USING btree ("EventTemplateId");


--
-- Name: IX_LivestockEvents_FieldId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_LivestockEvents_FieldId" ON public."LivestockEvents" USING btree ("FieldId");


--
-- Name: IX_LivestockEvents_LoteId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_LivestockEvents_LoteId" ON public."LivestockEvents" USING btree ("LoteId");


--
-- Name: IX_LivestockEvents_TenantId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_LivestockEvents_TenantId" ON public."LivestockEvents" USING btree ("TenantId");


--
-- Name: IX_Lotes_FieldId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_Lotes_FieldId" ON public."Lotes" USING btree ("FieldId");


--
-- Name: IX_Users_TenantId; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_Users_TenantId" ON public."Users" USING btree ("TenantId");


--
-- Name: AccountingDrafts FK_AccountingDrafts_LivestockEvents_LivestockEventId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountingDrafts"
    ADD CONSTRAINT "FK_AccountingDrafts_LivestockEvents_LivestockEventId" FOREIGN KEY ("LivestockEventId") REFERENCES public."LivestockEvents"("Id") ON DELETE CASCADE;


--
-- Name: AccountingDrafts FK_AccountingDrafts_Tenants_TenantId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountingDrafts"
    ADD CONSTRAINT "FK_AccountingDrafts_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants"("Id") ON DELETE CASCADE;


--
-- Name: Activities FK_Activities_Tenants_TenantId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Activities"
    ADD CONSTRAINT "FK_Activities_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants"("Id");


--
-- Name: ActivityLote FK_ActivityLote_Activities_ActivitiesId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ActivityLote"
    ADD CONSTRAINT "FK_ActivityLote_Activities_ActivitiesId" FOREIGN KEY ("ActivitiesId") REFERENCES public."Activities"("Id") ON DELETE CASCADE;


--
-- Name: ActivityLote FK_ActivityLote_Lotes_LoteId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ActivityLote"
    ADD CONSTRAINT "FK_ActivityLote_Lotes_LoteId" FOREIGN KEY ("LoteId") REFERENCES public."Lotes"("Id") ON DELETE CASCADE;


--
-- Name: AnimalCategories FK_AnimalCategories_Activities_ActivityId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AnimalCategories"
    ADD CONSTRAINT "FK_AnimalCategories_Activities_ActivityId" FOREIGN KEY ("ActivityId") REFERENCES public."Activities"("Id") ON DELETE CASCADE;


--
-- Name: AnimalCategories FK_AnimalCategories_Tenants_TenantId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AnimalCategories"
    ADD CONSTRAINT "FK_AnimalCategories_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants"("Id");


--
-- Name: EventTemplates FK_EventTemplates_Tenants_TenantId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EventTemplates"
    ADD CONSTRAINT "FK_EventTemplates_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants"("Id") ON DELETE CASCADE;


--
-- Name: ExternalCatalogs FK_ExternalCatalogs_Tenants_TenantId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ExternalCatalogs"
    ADD CONSTRAINT "FK_ExternalCatalogs_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants"("Id") ON DELETE CASCADE;


--
-- Name: Fields FK_Fields_Tenants_TenantId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Fields"
    ADD CONSTRAINT "FK_Fields_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants"("Id") ON DELETE CASCADE;


--
-- Name: GestorMaxConfigs FK_GestorMaxConfigs_Tenants_TenantId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."GestorMaxConfigs"
    ADD CONSTRAINT "FK_GestorMaxConfigs_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants"("Id") ON DELETE CASCADE;


--
-- Name: LivestockEvents FK_LivestockEvents_Activities_ActivityId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LivestockEvents"
    ADD CONSTRAINT "FK_LivestockEvents_Activities_ActivityId" FOREIGN KEY ("ActivityId") REFERENCES public."Activities"("Id");


--
-- Name: LivestockEvents FK_LivestockEvents_AnimalCategories_CategoryId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LivestockEvents"
    ADD CONSTRAINT "FK_LivestockEvents_AnimalCategories_CategoryId" FOREIGN KEY ("CategoryId") REFERENCES public."AnimalCategories"("Id");


--
-- Name: LivestockEvents FK_LivestockEvents_EventTemplates_EventTemplateId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LivestockEvents"
    ADD CONSTRAINT "FK_LivestockEvents_EventTemplates_EventTemplateId" FOREIGN KEY ("EventTemplateId") REFERENCES public."EventTemplates"("Id") ON DELETE CASCADE;


--
-- Name: LivestockEvents FK_LivestockEvents_Fields_FieldId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LivestockEvents"
    ADD CONSTRAINT "FK_LivestockEvents_Fields_FieldId" FOREIGN KEY ("FieldId") REFERENCES public."Fields"("Id");


--
-- Name: LivestockEvents FK_LivestockEvents_Lotes_LoteId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LivestockEvents"
    ADD CONSTRAINT "FK_LivestockEvents_Lotes_LoteId" FOREIGN KEY ("LoteId") REFERENCES public."Lotes"("Id");


--
-- Name: LivestockEvents FK_LivestockEvents_Tenants_TenantId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LivestockEvents"
    ADD CONSTRAINT "FK_LivestockEvents_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants"("Id") ON DELETE CASCADE;


--
-- Name: Lotes FK_Lotes_Fields_FieldId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Lotes"
    ADD CONSTRAINT "FK_Lotes_Fields_FieldId" FOREIGN KEY ("FieldId") REFERENCES public."Fields"("Id") ON DELETE CASCADE;


--
-- Name: Users FK_Users_Tenants_TenantId; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Users"
    ADD CONSTRAINT "FK_Users_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES public."Tenants"("Id") ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict OiK9nD2OCLK9W99bfpI5vWZu7O6UWa8AiTj0udVVYi8AjUEM8FUAxQfZCPvFDU3

