create table if not exists app_state (
  user_id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- Google OAuth currently creates an in-memory web session and stores each
-- user's workspace under app_state.user_id, such as google:123456.
-- Future normalized tables can grow from the JSON snapshot above once the
-- portfolio model settles.
