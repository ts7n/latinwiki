# frozen_string_literal: true

class AddProfileContentToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :profile_content, :text, default: "", null: false
  end
end
