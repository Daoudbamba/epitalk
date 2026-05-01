-- Migration 006: Add avatar_url to servers
BEGIN;

ALTER TABLE servers ADD COLUMN IF NOT EXISTS avatar_url TEXT;

INSERT INTO _migrations (name) VALUES ('006_add_server_avatar') ON CONFLICT DO NOTHING;

COMMIT;
