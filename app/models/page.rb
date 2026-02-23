class Page < ApplicationRecord
  attr_accessor :rationale

  belongs_to :parent, class_name: "Page", optional: true
  has_many :children, class_name: "Page", foreign_key: :parent_id, dependent: :nullify
  has_many :versions, class_name: "PageVersion", dependent: :destroy
  has_many :page_coordinators, dependent: :destroy
  has_many :coordinators, through: :page_coordinators, source: :user

  after_create :create_initial_version

  validates :title, presence: true
  validates :slug, presence: true
  validates :slug, uniqueness: { scope: :parent_id }

  scope :root_pages, -> { where(parent_id: nil) }
  scope :ordered, -> { order(:position, :title) }

  def self.for_sidebar
    root_pages.ordered.includes(children: :children)
  end

  def path
    parent ? "#{parent.path}/#{slug}" : slug
  end

  def create_initial_version
    versions.create!(title: title, content: content, version_number: 1, rationale: rationale)
  end

  def self.find_by_path(path_str)
    return nil if path_str.blank?

    slugs = path_str.to_s.split("/").reject(&:blank?)
    return nil if slugs.empty?

    page = nil
    slugs.each do |seg|
      if page.nil?
        page = root_pages.find_by(slug: seg)
      else
        page = page.children.find_by(slug: seg)
      end
      return nil unless page
    end
    page
  end
end
