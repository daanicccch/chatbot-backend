with moved_attachments as (
  update attachments
  set chat_id = $1
  where id = any($2::uuid[])
    and owner_type = $3
    and owner_id = $4
    and kind = 'document'
  returning id
),
moved_chunks as (
  update document_chunks
  set chat_id = $1
  where attachment_id in (select id from moved_attachments)
    and owner_type = $3
    and owner_id = $4
  returning id
)
select
  (select count(*)::int from moved_attachments) as attachment_count,
  (select count(*)::int from moved_chunks) as chunk_count;
