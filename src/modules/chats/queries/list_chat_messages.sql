select
  id,
  chat_id,
  role,
  content,
  status,
  model,
  error_text,
  created_at,
  updated_at
from messages
where chat_id = $1
order by created_at asc;
