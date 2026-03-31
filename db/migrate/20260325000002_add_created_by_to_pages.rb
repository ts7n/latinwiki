# frozen_string_literal: true

class AddCreatedByToPages < ActiveRecord::Migration[8.1]
  def change
    add_reference :pages, :created_by, foreign_key: { to_table: :users }, null: true
  end
end
