update messages
set content = $2,
    status = $3,
    error_text = $4,
    model = $5,
    updated_at = now()
where id = $1
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
