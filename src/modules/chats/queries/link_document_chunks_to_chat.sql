update document_chunks
set chat_id = $1
where attachment_id = any($2::uuid[])
  and owner_type = $3
  and owner_id = $4;
