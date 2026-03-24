update attachments
set chat_id = $1,
    message_id = $2
where id = any($3::uuid[])
  and owner_type = $4
  and owner_id = $5
  and kind = 'image'
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
  created_at;
