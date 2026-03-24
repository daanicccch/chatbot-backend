insert into document_chunks (
  attachment_id,
  owner_type,
  owner_id,
  chat_id,
  chunk_index,
  content
)
select
  $1,
  $2,
  $3,
  $4,
  chunk_index,
  content
from unnest($5::int[], $6::text[]) as chunk_rows(chunk_index, content);
