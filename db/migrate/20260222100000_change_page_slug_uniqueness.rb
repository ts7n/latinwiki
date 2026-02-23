class ChangePageSlugUniqueness < ActiveRecord::Migration[8.1]
  def change
    remove_index :pages, :slug
    add_index :pages, [ :parent_id, :slug ], unique: true
  end
end
