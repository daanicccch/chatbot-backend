update attachments
set chat_id = $1
where id = any($2::uuid[])
  and owner_type = $3
  and owner_id = $4
  and kind = 'document';
