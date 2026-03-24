"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      create index if not exists idx_messages_chat_role_created_desc
        on messages(chat_id, role, created_at desc);

      create index if not exists idx_document_chunks_owner_chat_created_desc
        on document_chunks(owner_type, owner_id, chat_id, created_at desc);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      drop index if exists idx_messages_chat_role_created_desc;
      drop index if exists idx_document_chunks_owner_chat_created_desc;
    `);
  },
};
