insert into messages (chat_id, role, content, status, model)
values ($1, 'assistant', '', 'streaming', $2)
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
