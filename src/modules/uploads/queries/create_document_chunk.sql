insert into document_chunks (
  attachment_id,
  owner_type,
  owner_id,
  chat_id,
  chunk_index,
  content
)
values ($1, $2, $3, $4, $5, $6);
