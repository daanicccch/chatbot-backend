with owned_chat as (
  select
    id,
    title,
    model,
    created_at,
    updated_at,
    last_message_at
  from chats
  where id = $1
    and owner_type = $2
    and owner_id = $3
),
message_counts as (
  select m.chat_id, count(*)::int as message_count
  from messages m
  join owned_chat oc on oc.id = m.chat_id
  group by m.chat_id
),
message_previews as (
  select distinct on (m.chat_id)
    m.chat_id,
    regexp_replace(m.content, '\s+', ' ', 'g') as preview
  from messages m
  join owned_chat oc on oc.id = m.chat_id
  order by m.chat_id, m.created_at desc
),
attachment_counts as (
  select a.chat_id, count(*)::int as attachment_count
  from attachments a
  join owned_chat oc on oc.id = a.chat_id
  group by a.chat_id
),
chat_summary as (
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
  from owned_chat oc
  left join message_counts mc on mc.chat_id = oc.id
  left join message_previews mp on mp.chat_id = oc.id
  left join attachment_counts ac on ac.chat_id = oc.id
),
message_rows as (
  select
    m.id,
    m.chat_id,
    m.role,
    m.content,
    m.status,
    m.model,
    m.error_text,
    m.created_at,
    m.updated_at
  from messages m
  join owned_chat oc on oc.id = m.chat_id
  order by
    m.created_at asc,
    case m.role
      when 'system' then 0
      when 'user' then 1
      when 'assistant' then 2
      else 3
    end asc,
    m.id asc
),
attachment_rows as (
  select
    a.id,
    a.chat_id,
    a.message_id,
    a.kind,
    a.filename,
    a.mime_type,
    a.size_bytes,
    a.storage_provider,
    a.storage_path,
    a.public_url,
    a.extracted_text,
    a.metadata,
    a.created_at
  from attachments a
  join owned_chat oc on oc.id = a.chat_id
  order by a.created_at asc
)
select
  cs.*,
  coalesce(
    (
      select json_agg(
        m
        order by
          m.created_at asc,
          case m.role
            when 'system' then 0
            when 'user' then 1
            when 'assistant' then 2
            else 3
          end asc,
          m.id asc
      )
      from message_rows m
    ),
    '[]'::json
  ) as messages,
  coalesce(
    (
      select json_agg(a order by a.created_at asc)
      from attachment_rows a
    ),
    '[]'::json
  ) as attachments
from chat_summary cs;
