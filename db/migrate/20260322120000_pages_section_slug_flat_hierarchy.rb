# frozen_string_literal: true

class PagesSectionSlugFlatHierarchy < ActiveRecord::Migration[8.1]
  def up
    add_column :pages, :section_slug, :string

    execute <<-SQL.squish
      UPDATE pages AS child
      SET section_slug = parent.slug
      FROM pages AS parent
      WHERE child.parent_id = parent.id
    SQL

    remove_foreign_key :pages, column: :parent_id
    remove_index :pages, column: [ :parent_id, :slug ], name: "index_pages_on_parent_id_and_slug"
    remove_index :pages, column: :parent_id, name: "index_pages_on_parent_id"
    remove_column :pages, :parent_id

    execute "DELETE FROM page_coordinators WHERE page_id IN (SELECT id FROM pages WHERE section_slug IS NULL)"
    execute "DELETE FROM page_versions WHERE page_id IN (SELECT id FROM pages WHERE section_slug IS NULL)"
    execute "DELETE FROM pages WHERE section_slug IS NULL"

    change_column_null :pages, :section_slug, false
    add_index :pages, [ :section_slug, :slug ], unique: true
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
