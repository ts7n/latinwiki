# frozen_string_literal: true

class Page < ApplicationRecord
  attr_accessor :rationale

  has_many :versions, class_name: "PageVersion", dependent: :destroy
  has_many :page_coordinators, dependent: :destroy
  has_many :coordinators, through: :page_coordinators, source: :user

  after_create :create_initial_version

  validates :title, presence: true
  validates :slug, presence: true
  validates :section_slug, presence: true
  validates :slug, uniqueness: { scope: :section_slug }
  validate :section_slug_matches_config

  scope :ordered, -> { order(:position, :title) }

  def path
    "#{section_slug}/#{slug}"
  end

  def create_initial_version
    versions.create!(title: title, content: content, version_number: 1, rationale: rationale)
  end

  def self.find_by_path(path_str)
    return nil if path_str.blank?

    slugs = path_str.to_s.split("/").reject(&:blank?)
    return nil unless slugs.size == 2

    section_slug, page_slug = slugs
    find_by(section_slug: section_slug, slug: page_slug)
  end

  def self.valid_section_slugs
    (Rails.application.config.wiki_sections || []).map { |s| (s[:slug] || s["slug"]).to_s }.reject(&:blank?)
  end

  private

  def section_slug_matches_config
    return if section_slug.blank?

    allowed = self.class.valid_section_slugs
    return if allowed.empty? # tests / bootstrapping

    unless allowed.include?(section_slug)
      errors.add(:section_slug, "is not a configured section")
    end
  end
end
