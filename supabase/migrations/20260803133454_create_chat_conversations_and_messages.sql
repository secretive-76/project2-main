/*
# Create chat_conversations and chat_messages tables

1. New Tables
- `chat_conversations`: Stores AI coach conversation threads (chat sessions).
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to authenticated user, references auth.users)
  - `title` (text, not null, default 'New conversation')
  - `created_at` (timestamp, default now())
  - `updated_at` (timestamp, default now, auto-updated via trigger)

- `chat_messages`: Stores individual messages within a conversation.
  - `id` (uuid, primary key)
  - `conversation_id` (uuid, not null, references chat_conversations ON DELETE CASCADE)
  - `user_id` (uuid, not null, defaults to authenticated user, references auth.users)
  - `role` (text, not null — 'user' or 'assistant')
  - `content` (text, not null)
  - `created_at` (timestamp, default now)

2. Indexes
- `idx_chat_conversations_user` on chat_conversations(user_id)
- `idx_chat_messages_conversation` on chat_messages(conversation_id)
- `idx_chat_messages_user` on chat_messages(user_id)

3. Security
- RLS enabled on both tables with owner-scoped CRUD (4 policies each, auth.uid() = user_id).
- user_id defaults to auth.uid() so inserts that omit user_id satisfy WITH CHECK.
- updated_at auto-set via set_updated_at() trigger function (created in a prior migration).

4. Notes
- Conversation title derived client-side from the first user message.
- Messages cascade-delete when a conversation is deleted.
*/

CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON chat_conversations(user_id);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat_conversations" ON chat_conversations;
CREATE POLICY "select_own_chat_conversations"
ON chat_conversations FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_chat_conversations" ON chat_conversations;
CREATE POLICY "insert_own_chat_conversations"
ON chat_conversations FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_chat_conversations" ON chat_conversations;
CREATE POLICY "update_own_chat_conversations"
ON chat_conversations FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_chat_conversations" ON chat_conversations;
CREATE POLICY "delete_own_chat_conversations"
ON chat_conversations FOR DELETE
TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_chat_conversations_updated ON chat_conversations;
CREATE TRIGGER trg_chat_conversations_updated
BEFORE UPDATE ON chat_conversations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat_messages" ON chat_messages;
CREATE POLICY "select_own_chat_messages"
ON chat_messages FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_chat_messages" ON chat_messages;
CREATE POLICY "insert_own_chat_messages"
ON chat_messages FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_chat_messages" ON chat_messages;
CREATE POLICY "update_own_chat_messages"
ON chat_messages FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_chat_messages" ON chat_messages;
CREATE POLICY "delete_own_chat_messages"
ON chat_messages FOR DELETE
TO authenticated USING (auth.uid() = user_id);
