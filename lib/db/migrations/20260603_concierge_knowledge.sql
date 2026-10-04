-- Additive only. Apply to development explicitly; run the identical transaction
-- against production through the deployment migration process before release.
BEGIN;
CREATE TABLE IF NOT EXISTS concierge_knowledge (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL, category text NOT NULL DEFAULT 'General',
 file_name text NOT NULL, content_type text NOT NULL, byte_size integer NOT NULL,
 object_path text NOT NULL, extracted_text text NOT NULL DEFAULT '',
 audience text NOT NULL DEFAULT 'staff' CHECK (audience IN ('staff','approved_dealers')),
 status text NOT NULL DEFAULT 'review' CHECK (status IN ('review','active','archived','error')),
 error_message text, created_by_account_id uuid NOT NULL REFERENCES accounts(id),
 deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS concierge_knowledge_eligibility_idx ON concierge_knowledge(status,audience);
CREATE TABLE IF NOT EXISTS concierge_knowledge_uploads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES accounts(id),
 object_path text NOT NULL, file_name text NOT NULL, content_type text NOT NULL,
 byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
 status text NOT NULL DEFAULT 'pending', generation text,
 document_id uuid REFERENCES concierge_knowledge(id),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;