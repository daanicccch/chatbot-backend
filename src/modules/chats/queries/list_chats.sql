with owned_chats as (
  select
    id,
    title,
    model,
    created_at,
    updated_at,
    last_message_at
  from chats
  where owner_type = $1
    and owner_id = $2
),
message_counts as (
  select m.chat_id, count(*)::int as message_count
  from messages m
  join owned_chats oc on oc.id = m.chat_id
  group by m.chat_id
),
message_previews as (
  select distinct on (m.chat_id)
    m.chat_id,
    regexp_replace(m.content, '\s+', ' ', 'g') as preview
  from messages m
  join owned_chats oc on oc.id = m.chat_id
  order by m.chat_id, m.created_at desc
),
attachment_counts as (
  select a.chat_id, count(*)::int as attachment_count
  from attachments a
  join owned_chats oc on oc.id = a.chat_id
  group by a.chat_id
)
select
  oc.id,
  oc.title,
  oc.model,
  oc.created_at,
  oc.updated_at,
  oc.last_message_at,
  coalesce(mp.preview, '') as preview,
  coalesce(mc.message_count, 0) as message_count,
  coalesce(ac.attachment_count, 0) as attachment_count
from owned_chats oc
left join message_counts mc on mc.chat_id = oc.id
left join message_previews mp on mp.chat_id = oc.id
left join attachment_counts ac on ac.chat_id = oc.id
order by oc.last_message_at desc;
