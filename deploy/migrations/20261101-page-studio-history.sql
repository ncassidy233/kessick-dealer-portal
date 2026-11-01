-- Additive migration; run once before deploying Page Studio publication APIs.
BEGIN;
CREATE TABLE IF NOT EXISTS portal_page_history (
  page_key studio_page_key NOT NULL,
  revision integer NOT NULL,
  document jsonb NOT NULL,
  published_by_account_id uuid NOT NULL REFERENCES accounts(id),
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (page_key, revision)
);
INSERT INTO portal_page_history (page_key, revision, document, published_by_account_id, published_at)
SELECT page_key, revision, document, published_by_account_id, published_at FROM portal_page_publications
ON CONFLICT DO NOTHING;
COMMIT;
