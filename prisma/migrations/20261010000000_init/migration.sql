-- CreateTable
CREATE TABLE "Link" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Link_alias_key" ON "Link"("alias");

-- CreateIndex
CREATE INDEX "Link_createdAt_idx" ON "Link"("createdAt" DESC);

-- Hand-added guards (Prisma cannot express CHECK constraints). The app validates
-- first and gives friendly errors; these make the database the last line of defence.
-- Alias: lowercase letters, digits, hyphen, underscore; 1-64 chars; starts and ends
-- with a letter or digit.
ALTER TABLE "Link" ADD CONSTRAINT "Link_alias_format_check"
    CHECK ("alias" ~ '^[a-z0-9]([a-z0-9_-]{0,62}[a-z0-9])?$');

-- Destination: http(s) only, bounded length.
ALTER TABLE "Link" ADD CONSTRAINT "Link_destination_check"
    CHECK ("destination" ~* '^https?://' AND char_length("destination") <= 8192);

ALTER TABLE "Link" ADD CONSTRAINT "Link_clicks_nonnegative_check"
    CHECK ("clicks" >= 0);
