# frozen_string_literal: true

class PageCoordinator < ApplicationRecord
  belongs_to :page
  belongs_to :user

  validates :page_id, uniqueness: { scope: :user_id }
end
