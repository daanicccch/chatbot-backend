insert into chats (owner_type, owner_id, title, model)
values ($1, $2, 'New chat', $3)
returning
  id,
  title,
  model,
  created_at,
  updated_at,
  last_message_at,
  ''::text as preview,
  0::int as message_count,
  0::int as attachment_count;
