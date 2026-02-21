-- Add sync control fields to databases table
ALTER TABLE databases
  ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS pages_synced INTEGER DEFAULT 0;

-- Index for active databases lookup (used by webhook router)
CREATE INDEX IF NOT EXISTS idx_databases_enabled ON databases(sync_enabled);