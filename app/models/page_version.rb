class PageVersion < ApplicationRecord
  belongs_to :page
  belongs_to :user, optional: true

  validates :version_number, presence: true, uniqueness: { scope: :page_id }
  validates :title, presence: true

  scope :recent, -> { order(created_at: :desc) }
end
