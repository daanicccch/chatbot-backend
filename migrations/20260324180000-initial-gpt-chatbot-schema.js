"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      create extension if not exists "pgcrypto";

      create or replace function set_updated_at()
      returns trigger
      language plpgsql
      as $$
      begin
        new.updated_at = now();
        return new;
      end;
      $$;

      create or replace function cleanup_user_owned_records()
      returns trigger
      language plpgsql
      as $$
      begin
        delete from document_chunks
        where owner_type = 'user' and owner_id = old.id;

        delete from attachments
        where owner_type = 'user' and owner_id = old.id;

        delete from chats
        where owner_type = 'user' and owner_id = old.id;

        return old;
      end;
      $$;

      create table if not exists app_users (
        id uuid primary key default gen_random_uuid(),
        email text not null unique,
        password_hash text not null,
        display_name text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists user_sessions (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references app_users(id) on delete cascade,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      );

      create index if not exists idx_user_sessions_user_id on user_sessions(user_id);
      create index if not exists idx_user_sessions_expires_at on user_sessions(expires_at);

      create table if not exists guest_profiles (
        id uuid primary key default gen_random_uuid(),
        free_questions_used integer not null default 0,
        created_at timestamptz not null default now(),
        last_seen_at timestamptz not null default now()
      );

      create table if not exists chats (
        id uuid primary key default gen_random_uuid(),
        owner_type text not null check (owner_type in ('user', 'guest')),
        owner_id uuid not null,
        title text not null default 'New chat',
        model text not null default 'gemini-2.5-flash',
        last_message_at timestamptz not null default now(),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create index if not exists idx_chats_owner_lookup
        on chats(owner_type, owner_id, last_message_at desc);

      create table if not exists messages (
        id uuid primary key default gen_random_uuid(),
        chat_id uuid not null references chats(id) on delete cascade,
        role text not null check (role in ('system', 'user', 'assistant')),
        content text not null default '',
        status text not null default 'completed' check (status in ('streaming', 'completed', 'error')),
        model text,
        error_text text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create index if not exists idx_messages_chat_order
        on messages(chat_id, created_at asc);

      create table if not exists attachments (
        id uuid primary key default gen_random_uuid(),
        owner_type text not null check (owner_type in ('user', 'guest')),
        owner_id uuid not null,
        chat_id uuid references chats(id) on delete cascade,
        message_id uuid references messages(id) on delete cascade,
        kind text not null check (kind in ('image', 'document')),
        filename text not null,
        mime_type text not null,
        size_bytes integer not null default 0,
        storage_provider text not null,
        storage_path text not null,
        public_url text not null,
        extracted_text text,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );

      create index if not exists idx_attachments_owner_lookup
        on attachments(owner_type, owner_id, created_at desc);

      create index if not exists idx_attachments_chat_lookup
        on attachments(chat_id, created_at asc);

      create index if not exists idx_attachments_message_lookup
        on attachments(message_id, created_at asc);

      create table if not exists document_chunks (
        id uuid primary key default gen_random_uuid(),
        attachment_id uuid not null references attachments(id) on delete cascade,
        owner_type text not null check (owner_type in ('user', 'guest')),
        owner_id uuid not null,
        chat_id uuid references chats(id) on delete cascade,
        chunk_index integer not null,
        content text not null,
        content_tsv tsvector generated always as (to_tsvector('simple', coalesce(content, ''))) stored,
        created_at timestamptz not null default now()
      );

      create unique index if not exists idx_document_chunks_unique
        on document_chunks(attachment_id, chunk_index);

      create index if not exists idx_document_chunks_owner_lookup
        on document_chunks(owner_type, owner_id, created_at desc);

      create index if not exists idx_document_chunks_chat_lookup
        on document_chunks(chat_id, created_at desc);

      create index if not exists idx_document_chunks_search
        on document_chunks using gin(content_tsv);

      drop trigger if exists trg_app_users_updated_at on app_users;
      create trigger trg_app_users_updated_at
      before update on app_users
      for each row
      execute function set_updated_at();

      drop trigger if exists trg_app_users_cleanup_owned_records on app_users;
      create trigger trg_app_users_cleanup_owned_records
      after delete on app_users
      for each row
      execute function cleanup_user_owned_records();

      drop trigger if exists trg_chats_updated_at on chats;
      create trigger trg_chats_updated_at
      before update on chats
      for each row
      execute function set_updated_at();

      drop trigger if exists trg_messages_updated_at on messages;
      create trigger trg_messages_updated_at
      before update on messages
      for each row
      execute function set_updated_at();
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      drop table if exists document_chunks;
      drop table if exists attachments;
      drop table if exists messages;
      drop table if exists chats;
      drop table if exists guest_profiles;
      drop table if exists user_sessions;
      drop table if exists app_users;
      drop function if exists cleanup_user_owned_records();
      drop function if exists set_updated_at();
    `);
  },
};
