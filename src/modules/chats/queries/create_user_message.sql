insert into messages (chat_id, role, content, status)
values ($1, 'user', $2, 'completed')
returning
  id,
  chat_id,
  role,
  content,
  status,
  model,
  error_text,
  created_at,
  updated_at;
