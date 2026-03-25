CREATE TABLE "auth_rate_limit_buckets" (
    "bucket_key" text PRIMARY KEY,
    "count" integer NOT NULL,
    "reset_at" timestamptz NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT NOW(),
    "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX "auth_rate_limit_buckets_reset_at_idx"
    ON "auth_rate_limit_buckets" ("reset_at");

