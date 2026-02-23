class CreatePages < ActiveRecord::Migration[8.1]
  def change
    create_table :pages do |t|
      t.string :title, null: false
      t.string :slug, null: false
      t.text :content, default: ""
      t.references :parent, foreign_key: { to_table: :pages }
      t.integer :position, default: 0, null: false

      t.timestamps
    end

    add_index :pages, :slug, unique: true
  end
end
