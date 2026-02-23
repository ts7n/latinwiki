class AddPronounsAndShowEmailToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :pronouns, :string
    add_column :users, :show_email, :boolean, default: true, null: false
  end
end
