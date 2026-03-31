# frozen_string_literal: true

class AddUnlistedToPages < ActiveRecord::Migration[8.1]
  def change
    add_column :pages, :unlisted, :boolean, default: false, null: false
  end
end
