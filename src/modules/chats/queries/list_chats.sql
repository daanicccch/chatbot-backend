select
  c.id,
  c.title,
  c.model,
  c.created_at,
  c.updated_at,
  c.last_message_at,
  coalesce(
    (
      select regexp_replace(content, '\s+', ' ', 'g')
      from messages
      where chat_id = c.id
      order by created_at desc
      limit 1
    ),
    ''
  ) as preview,
  (
    select count(*)::int
    from messages
    where chat_id = c.id
  ) as message_count,
  (
    select count(*)::int
    from attachments
    where chat_id = c.id
  ) as attachment_count
from chats c
where c.owner_type = $1
  and c.owner_id = $2
order by c.last_message_at desc;
