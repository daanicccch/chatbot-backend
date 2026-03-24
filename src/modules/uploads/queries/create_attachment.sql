with eligible_chat as (
  select id
  from chats
  where id = $3
    and owner_type = $1
    and owner_id = $2
),
inserted_attachment as (
  insert into attachments (
    owner_type,
    owner_id,
    chat_id,
    kind,
    filename,
    mime_type,
    size_bytes,
    storage_provider,
    storage_path,
    public_url,
    extracted_text,
    metadata
  )
  select
    $1,
    $2,
    case
      when $3 is null then null
      else (select id from eligible_chat)
    end,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12::jsonb
  where $3 is null
    or exists (select 1 from eligible_chat)
  returning
    id,
    chat_id,
    message_id,
    kind,
    filename,
    mime_type,
    size_bytes,
    storage_provider,
    storage_path,
    public_url,
    extracted_text,
    metadata,
    created_at
)
select *
from inserted_attachment;
