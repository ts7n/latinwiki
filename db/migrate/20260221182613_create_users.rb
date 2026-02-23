class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :name
      t.string :email
      t.string :google_uid
      t.string :avatar_url

      t.timestamps
    end
  end
end
