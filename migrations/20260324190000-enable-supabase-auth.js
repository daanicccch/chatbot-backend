"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      alter table app_users
      add column if not exists supabase_user_id uuid;

      alter table app_users
      alter column password_hash drop not null;

      create unique index if not exists idx_app_users_supabase_user_id
        on app_users (supabase_user_id)
        where supabase_user_id is not null;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      update app_users
      set password_hash = '__supabase_managed__'
      where password_hash is null;

      drop index if exists idx_app_users_supabase_user_id;

      alter table app_users
      drop column if exists supabase_user_id;

      alter table app_users
      alter column password_hash set not null;
    `);
  },
};
