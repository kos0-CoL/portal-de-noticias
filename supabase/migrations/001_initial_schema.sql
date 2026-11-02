-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================ ENUMS =======================================

CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR');
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ArticlePriority" AS ENUM ('NORMAL', 'ALTA', 'URGENTE');
CREATE TYPE "AiTonality" AS ENUM ('INFORMATIVO_NEUTRAL', 'CERCANO_LOCAL', 'LLAMATIVO_CLICKBAIT', 'FORMAL_SERIO');
CREATE TYPE "BannerType" AS ENUM ('IMAGE', 'ADSENSE', 'HTML', 'ROTATING');
CREATE TYPE "BannerZone" AS ENUM ('HEADER', 'HOME_TOP', 'INLINE_ARTICLE', 'SIDEBAR', 'FOOTER', 'MOBILE_STICKY');
CREATE TYPE "SourceStatus" AS ENUM ('IDLE', 'RUNNING', 'OK', 'ERROR');
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'ERROR');
CREATE TYPE "ScrapedItemStatus" AS ENUM ('PENDING', 'PROCESSED', 'DISCARDED', 'ERROR');
CREATE TYPE "SocialNetwork" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'TELEGRAM', 'X', 'WHATSAPP');
CREATE TYPE "SocialPostStatus" AS ENUM ('PENDING', 'SENT', 'ERROR', 'SKIPPED');
CREATE TYPE "ClassifiedStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'EXPIRED');
CREATE TYPE "KeywordType" AS ENUM ('LOCALIDAD', 'FUNCIONARIO', 'TEMA');
CREATE TYPE "NewsletterStatus" AS ENUM ('ACTIVO', 'DADO_DE_BAJA');
CREATE TYPE "CommentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SPAM');
CREATE TYPE "NewsletterCampaignStatus" AS ENUM ('BORRADOR', 'PROGRAMADA', 'ENVIADA', 'ERROR', 'CANCELADA');
CREATE TYPE "SubscriptionPlanInterval" AS ENUM ('MENSUAL', 'ANUAL');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVA', 'CANCELADA', 'EXPIRADA', 'PAUSA', 'PENDIENTE_PAGO');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO');

-- ============================ USUARIOS ====================================

CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================ CONTENIDO ===================================

CREATE TABLE "categories" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "name" TEXT NOT NULL UNIQUE,
    "slug" TEXT NOT NULL UNIQUE,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#122A4D',
    "iconName" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isMenu" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "tags" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "name" TEXT NOT NULL UNIQUE,
    "slug" TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "articles" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "coverImage" TEXT,
    "coverImageAlt" TEXT,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "ArticlePriority" NOT NULL DEFAULT 'NORMAL',
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "socialSummary" TEXT,
    "focusKeyword" TEXT,
    "ogImage" TEXT,
    "readingTime" INTEGER NOT NULL DEFAULT 1,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isBreaking" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "sourcePublishedAt" TIMESTAMPTZ,
    "scrapedItemId" TEXT UNIQUE,
    "aiTonality" "AiTonality",
    "aiRewritten" BOOLEAN NOT NULL DEFAULT false,
    "aiModel" TEXT,
    "aiCitesSource" BOOLEAN NOT NULL DEFAULT false,
    "originalityScore" DOUBLE PRECISION,
    "reviewNotes" TEXT,
    "categoryId" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id"),
    CONSTRAINT "articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE TABLE "article_images" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "articleId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "originalUrl" TEXT,
    "alt" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "article_images_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE
);

-- ============================ CLASIFICADOS ================================

CREATE TABLE "classifieds" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "section" TEXT NOT NULL DEFAULT 'Comunidad',
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "locality" TEXT NOT NULL DEFAULT 'Saladillo',
    "imageUrl" TEXT,
    "status" "ClassifiedStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "classified_images" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "classifiedId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "classified_images_classifiedId_fkey" FOREIGN KEY ("classifiedId") REFERENCES "classifieds"("id") ON DELETE CASCADE
);

-- ============================ SERVICIOS DE LA CIUDAD ======================

CREATE TABLE "pharmacies" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "pharmacy_shifts" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "pharmacyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "pharmacy_shifts_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "pharmacies"("id") ON DELETE CASCADE,
    CONSTRAINT "pharmacy_shifts_pharmacyId_date_key" UNIQUE ("pharmacyId", "date")
);

-- ============================ CONFIGURACION ===============================

CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "key" TEXT NOT NULL UNIQUE,
    "value" JSONB NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "group" TEXT NOT NULL DEFAULT 'general',
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================ PUBLICIDAD ==================================

CREATE TABLE "banners" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "name" TEXT NOT NULL,
    "advertiser" TEXT,
    "type" "BannerType" NOT NULL DEFAULT 'IMAGE',
    "zone" "BannerZone" NOT NULL,
    "imageUrl" TEXT,
    "targetUrl" TEXT,
    "htmlCode" TEXT,
    "adSlot" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMPTZ,
    "endsAt" TIMESTAMPTZ,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================ SCRAPING ====================================

CREATE TABLE "sources" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "SourceStatus" NOT NULL DEFAULT 'IDLE',
    "rotateUserAgent" BOOLEAN NOT NULL DEFAULT true,
    "requestDelayMs" INTEGER NOT NULL DEFAULT 1500,
    "maxItemsPerRun" INTEGER NOT NULL DEFAULT 20,
    "respectRobots" BOOLEAN NOT NULL DEFAULT true,
    "usePuppeteer" BOOLEAN NOT NULL DEFAULT false,
    "crawlSelector" TEXT,
    "articleSelector" TEXT,
    "titleSelector" TEXT,
    "imageSelector" TEXT,
    "scheduleCron" TEXT,
    "lastRunAt" TIMESTAMPTZ,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "source_category_mappings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "sourceId" TEXT NOT NULL,
    "externalCategoryName" TEXT NOT NULL,
    "externalCategoryUrl" TEXT NOT NULL,
    "localCategoryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "source_category_mappings_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE,
    CONSTRAINT "source_category_mappings_localCategoryId_fkey" FOREIGN KEY ("localCategoryId") REFERENCES "categories"("id") ON DELETE CASCADE,
    CONSTRAINT "source_category_mappings_sourceId_externalCategoryUrl_key" UNIQUE ("sourceId", "externalCategoryUrl")
);

CREATE TABLE "scrape_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "sourceId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "finishedAt" TIMESTAMPTZ,
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "itemsSkipped" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "log" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    CONSTRAINT "scrape_jobs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE,
    CONSTRAINT "scrape_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE TABLE "scraped_items" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "jobId" TEXT,
    "sourceId" TEXT NOT NULL,
    "externalCategory" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "rawContent" TEXT,
    "rawImageUrl" TEXT,
    "publishedAt" TIMESTAMPTZ,
    "matchedKeywords" TEXT[] NOT NULL DEFAULT '{}',
    "priority" "ArticlePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "ScrapedItemStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "contentHash" TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "processedAt" TIMESTAMPTZ,
    CONSTRAINT "scraped_items_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "scrape_jobs"("id") ON DELETE SET NULL,
    CONSTRAINT "scraped_items_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE
);

-- ============================ FILTRO LOCAL ================================

CREATE TABLE "keywords" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "word" TEXT NOT NULL UNIQUE,
    "type" "KeywordType" NOT NULL DEFAULT 'LOCALIDAD',
    "weight" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================ REDES SOCIALES ==============================

CREATE TABLE "social_channels" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "network" "SocialNetwork" NOT NULL,
    "name" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "accessToken" TEXT,
    "chatId" TEXT,
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "social_posts" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "articleId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" "SocialPostStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "permalink" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "social_posts_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE,
    CONSTRAINT "social_posts_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "social_channels"("id") ON DELETE CASCADE,
    CONSTRAINT "social_posts_articleId_channelId_key" UNIQUE ("articleId", "channelId")
);

-- ============================ NEWSLETTER ==================================

CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT,
    "status" "NewsletterStatus" NOT NULL DEFAULT 'ACTIVO',
    "source" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================ COMENTARIOS ================================

CREATE TABLE "comments" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "articleId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorEmail" TEXT,
    "content" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'PENDING',
    "parentId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "comments_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE,
    CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE SET NULL
);

-- ============================ NEWSLETTER ENVÍOS ==========================

CREATE TABLE "newsletter_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "titulo" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'resumen_diario',
    "status" "NewsletterCampaignStatus" NOT NULL DEFAULT 'BORRADOR',
    "enviados" INTEGER NOT NULL DEFAULT 0,
    "fallidos" INTEGER NOT NULL DEFAULT 0,
    "totalSuscriptores" INTEGER NOT NULL DEFAULT 0,
    "enviadoPor" TEXT,
    "enviadoAt" TIMESTAMPTZ,
    "programadoPara" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "newsletter_sends" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "campaignId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "enviadoAt" TIMESTAMPTZ,
    "error" TEXT,
    "mensajeId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "newsletter_sends_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "newsletter_campaigns"("id") ON DELETE CASCADE,
    CONSTRAINT "newsletter_sends_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "newsletter_subscribers"("id") ON DELETE CASCADE
);

-- ============================ SEO Y LEGALES ================================

CREATE TABLE "site_seo" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "siteTitle" TEXT NOT NULL DEFAULT 'Saladillo Noticias',
    "siteTagline" TEXT NOT NULL DEFAULT 'El diario de nuestra ciudad',
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "keywords" JSONB NOT NULL DEFAULT '[]',
    "ogImage" TEXT,
    "twitterCard" TEXT NOT NULL DEFAULT 'summary_large_image',
    "googleAnalyticsId" TEXT,
    "googleSearchConsoleId" TEXT,
    "facebookPixelId" TEXT,
    "robots" TEXT NOT NULL DEFAULT 'index, follow',
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "cookie_consents" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "essential" BOOLEAN NOT NULL DEFAULT true,
    "analytics" BOOLEAN NOT NULL DEFAULT false,
    "marketing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "legal_pages" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "slug" TEXT NOT NULL UNIQUE,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================ PAYWALL / SUSCRIPCIONES ======================

CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(12,2) NOT NULL,
    "intervalo" "SubscriptionPlanInterval" NOT NULL DEFAULT 'MENSUAL',
    "diasDuracion" INTEGER NOT NULL DEFAULT 30,
    "caracteristicas" JSONB NOT NULL DEFAULT '[]',
    "esPopular" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "user_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDIENTE_PAGO',
    "startedAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ,
    "renovacionAuto" BOOLEAN NOT NULL DEFAULT true,
    "canceladoEn" TIMESTAMPTZ,
    "motivoCancelacion" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "user_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "user_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id")
);

CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    "subscriptionId" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "estado" "PaymentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "proveedor" TEXT NOT NULL DEFAULT 'mercadopago',
    "referenciaExterna" TEXT,
    "fechaPago" TIMESTAMPTZ,
    "comprobanteUrl" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "user_subscriptions"("id") ON DELETE CASCADE
);

-- ============================ ÍNDICES ====================================

CREATE INDEX "articles_status_publishedAt_idx" ON "articles"("status", "publishedAt");
CREATE INDEX "articles_categoryId_status_idx" ON "articles"("categoryId", "status");
CREATE INDEX "articles_priority_idx" ON "articles"("priority");
CREATE INDEX "article_images_articleId_idx" ON "article_images"("articleId");
CREATE INDEX "classifieds_status_section_idx" ON "classifieds"("status", "section");
CREATE INDEX "classifieds_status_expiresAt_idx" ON "classifieds"("status", "expiresAt");
CREATE INDEX "classified_images_classifiedId_idx" ON "classified_images"("classifiedId");
CREATE INDEX "settings_group_idx" ON "settings"("group");
CREATE INDEX "banners_zone_isActive_idx" ON "banners"("zone", "isActive");
CREATE INDEX "scrape_jobs_sourceId_startedAt_idx" ON "scrape_jobs"("sourceId", "startedAt");
CREATE INDEX "scraped_items_sourceId_status_idx" ON "scraped_items"("sourceId", "status");
CREATE INDEX "scraped_items_priority_idx" ON "scraped_items"("priority");
CREATE INDEX "social_posts_status_idx" ON "social_posts"("status");
CREATE INDEX "newsletter_subscribers_email_idx" ON "newsletter_subscribers"("email");
CREATE INDEX "newsletter_subscribers_status_idx" ON "newsletter_subscribers"("status");
CREATE INDEX "comments_articleId_status_idx" ON "comments"("articleId", "status");
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");
CREATE INDEX "newsletter_campaigns_status_idx" ON "newsletter_campaigns"("status");
CREATE INDEX "newsletter_campaigns_programadoPara_idx" ON "newsletter_campaigns"("programadoPara");
CREATE INDEX "newsletter_sends_campaignId_idx" ON "newsletter_sends"("campaignId");
CREATE INDEX "newsletter_sends_subscriberId_idx" ON "newsletter_sends"("subscriberId");
CREATE INDEX "newsletter_sends_estado_idx" ON "newsletter_sends"("estado");
CREATE INDEX "cookie_consents_sessionId_idx" ON "cookie_consents"("sessionId");
CREATE INDEX "legal_pages_slug_idx" ON "legal_pages"("slug");
CREATE INDEX "subscription_plans_activo_intervalo_idx" ON "subscription_plans"("activo", "intervalo");
CREATE INDEX "subscription_plans_planId_idx" ON "user_subscriptions"("planId");
CREATE INDEX "subscription_plans_userId_status_idx" ON "user_subscriptions"("userId", "status");
CREATE INDEX "payments_subscriptionId_idx" ON "payments"("subscriptionId");
CREATE INDEX "payments_estado_idx" ON "payments"("estado");

-- ============================ DATOS INICIALES ============================

-- Páginas legales (SEO y Google)
INSERT INTO "legal_pages" ("id", "slug", "title", "content", "metaTitle", "metaDescription", "isActive") VALUES
('legal-privacidad-001', 'privacidad', 'Política de Privacidad', '<h1>Política de Privacidad</h1><p>En Saladillo Noticias respetamos tu privacidad. Esta política explica cómo recopilamos, usamos y protegemos tu información personal.</p>', 'Política de Privacidad - Saladillo Noticias', 'Conocé cómo protegemos tus datos personales en Saladillo Noticias.', true),
('legal-terminos-002', 'terminos', 'Términos y Condiciones', '<h1>Términos y Condiciones</h1><p>Al usar Saladillo Noticias aceptás estos términos de uso. Leelos detenidamente antes de continuar.</p>', 'Términos y Condiciones - Saladillo Noticias', 'Términos y condiciones de uso de Saladillo Noticias.', true),
('legal-cookies-003', 'cookies', 'Política de Cookies', '<h1>Política de Cookies</h1><p>Usamos cookies para mejorar tu experiencia en nuestro sitio. Podés configurar tus preferencias en cualquier momento.</p>', 'Política de Cookies - Saladillo Noticias', 'Información sobre el uso de cookies en Saladillo Noticias.', true),
('legal-contacto-004', 'contacto', 'Contacto', '<h1>Contacto</h1><p>Podés escribirnos a la redacción de Saladillo Noticias para consultas, sugerencias o avisos.</p>', 'Contacto - Saladillo Noticias', 'Contactate con la redacción de Saladillo Noticias.', true);

-- Configuración SEO del sitio
INSERT INTO "site_seo" ("id", "siteTitle", "siteTagline", "metaTitle", "metaDescription", "keywords", "robots") VALUES
('seo-global-001', 'Saladillo Noticias', 'El diario de nuestra ciudad', 'Saladillo Noticias - Noticias de Saladillo y la región', 'Noticias locales de Saladillo, Buenos Aires. Información al día sobre tu ciudad.', '["Saladillo", "noticias", "Buenos Aires", "local"]', 'index, follow');