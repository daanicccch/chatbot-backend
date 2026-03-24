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
  and id <> $2
  and role in ('user', 'assistant')
order by
  created_at desc,
  case role
    when 'assistant' then 0
    when 'user' then 1
    else 2
  end asc,
  id desc
limit $3;
