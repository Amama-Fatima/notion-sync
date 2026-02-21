-- Add unique constraint on notion_workspace_id so ON CONFLICT targeting works
ALTER TABLE users
  ADD CONSTRAINT users_notion_workspace_id_unique UNIQUE (notion_workspace_id);