-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Catalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "format" TEXT NOT NULL DEFAULT 'NORMAL',
    "orientation" TEXT NOT NULL DEFAULT 'PORTRAIT',
    "customWidth" DOUBLE PRECISION,
    "customHeight" DOUBLE PRECISION,
    "marginTop" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "marginBottom" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "marginLeft" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "marginRight" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "colorPrimary" TEXT NOT NULL DEFAULT '#F64851',
    "colorSecondary" TEXT NOT NULL DEFAULT '#1F2937',
    "colorText" TEXT NOT NULL DEFAULT '#111827',
    "colorBackground" TEXT NOT NULL DEFAULT '#FFFFFF',
    "version" INTEGER NOT NULL DEFAULT 1,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogPage" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT,
    "backgroundColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageElement" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "zIndex" INTEGER NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT,
    "fontSize" DOUBLE PRECISION,
    "fontFamily" TEXT,
    "fontWeight" INTEGER,
    "fontStyle" TEXT,
    "lineHeight" DOUBLE PRECISION,
    "letterSpacing" DOUBLE PRECISION,
    "textAlign" TEXT,
    "verticalAlign" TEXT,
    "color" TEXT,
    "backgroundColor" TEXT,
    "borderWidth" DOUBLE PRECISION,
    "borderColor" TEXT,
    "borderStyle" TEXT,
    "borderRadius" DOUBLE PRECISION,
    "padding" DOUBLE PRECISION,
    "opacity" DOUBLE PRECISION,
    "imageId" TEXT,
    "objectFit" TEXT,
    "props" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "format" TEXT,
    "bytes" INTEGER,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Catalog_updatedAt_idx" ON "Catalog"("updatedAt");

-- CreateIndex
CREATE INDEX "CatalogPage_catalogId_order_idx" ON "CatalogPage"("catalogId", "order");

-- CreateIndex
CREATE INDEX "PageElement_pageId_idx" ON "PageElement"("pageId");

-- CreateIndex
CREATE INDEX "PageElement_imageId_idx" ON "PageElement"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "Image_publicId_key" ON "Image"("publicId");

-- CreateIndex
CREATE INDEX "Image_createdAt_idx" ON "Image"("createdAt");

-- AddForeignKey
ALTER TABLE "Catalog" ADD CONSTRAINT "Catalog_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogPage" ADD CONSTRAINT "CatalogPage_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageElement" ADD CONSTRAINT "PageElement_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "CatalogPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageElement" ADD CONSTRAINT "PageElement_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
