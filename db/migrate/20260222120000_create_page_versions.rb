class CreatePageVersions < ActiveRecord::Migration[8.1]
  def change
    create_table :page_versions do |t|
      t.references :page, null: false, foreign_key: true
      t.references :user, null: true, foreign_key: true
      t.string :title, null: false
      t.text :content, default: "", null: false
      t.integer :version_number, null: false

      t.timestamps
    end

    add_index :page_versions, [ :page_id, :version_number ], unique: true
  end
end
