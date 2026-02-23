# frozen_string_literal: true

class CreatePageCoordinators < ActiveRecord::Migration[8.1]
  def change
    create_table :page_coordinators do |t|
      t.references :page, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true

      t.timestamps
    end

    add_index :page_coordinators, [ :page_id, :user_id ], unique: true
  end
end
