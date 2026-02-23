# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_02_24_000002) do
  create_table "allowed_emails", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_allowed_emails_on_email", unique: true
  end

  create_table "page_coordinators", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "page_id", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["page_id", "user_id"], name: "index_page_coordinators_on_page_id_and_user_id", unique: true
    t.index ["page_id"], name: "index_page_coordinators_on_page_id"
    t.index ["user_id"], name: "index_page_coordinators_on_user_id"
  end

  create_table "page_versions", force: :cascade do |t|
    t.text "content", default: "", null: false
    t.datetime "created_at", null: false
    t.integer "page_id", null: false
    t.string "rationale"
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id"
    t.integer "version_number", null: false
    t.index ["page_id", "version_number"], name: "index_page_versions_on_page_id_and_version_number", unique: true
    t.index ["page_id"], name: "index_page_versions_on_page_id"
    t.index ["user_id"], name: "index_page_versions_on_user_id"
  end

  create_table "pages", force: :cascade do |t|
    t.text "content", default: ""
    t.datetime "created_at", null: false
    t.integer "parent_id"
    t.integer "position", default: 0, null: false
    t.string "slug", null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.index ["parent_id", "slug"], name: "index_pages_on_parent_id_and_slug", unique: true
    t.index ["parent_id"], name: "index_pages_on_parent_id"
  end

  create_table "users", force: :cascade do |t|
    t.boolean "admin", default: false, null: false
    t.string "avatar_url"
    t.datetime "created_at", null: false
    t.string "description"
    t.string "email"
    t.string "google_uid"
    t.string "name"
    t.text "profile_content", default: "", null: false
    t.string "pronouns"
    t.boolean "show_email", default: true, null: false
    t.datetime "updated_at", null: false
  end

  add_foreign_key "page_coordinators", "pages"
  add_foreign_key "page_coordinators", "users"
  add_foreign_key "page_versions", "pages"
  add_foreign_key "page_versions", "users"
  add_foreign_key "pages", "pages", column: "parent_id"
end
