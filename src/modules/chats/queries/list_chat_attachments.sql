select
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
from attachments
where chat_id = $1
order by created_at asc;
