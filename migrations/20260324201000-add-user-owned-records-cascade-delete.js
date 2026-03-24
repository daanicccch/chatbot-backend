"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
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

      drop trigger if exists trg_app_users_cleanup_owned_records on app_users;
      create trigger trg_app_users_cleanup_owned_records
      after delete on app_users
      for each row
      execute function cleanup_user_owned_records();
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      drop trigger if exists trg_app_users_cleanup_owned_records on app_users;
      drop function if exists cleanup_user_owned_records();
    `);
  },
};
