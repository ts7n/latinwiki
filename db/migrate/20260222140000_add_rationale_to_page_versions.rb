# frozen_string_literal: true

class AddRationaleToPageVersions < ActiveRecord::Migration[8.1]
  def change
    add_column :page_versions, :rationale, :string
  end
end
