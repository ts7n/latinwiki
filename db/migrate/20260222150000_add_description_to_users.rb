# frozen_string_literal: true

class AddDescriptionToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :description, :string
  end
end
