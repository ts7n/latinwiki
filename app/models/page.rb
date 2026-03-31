# frozen_string_literal: true

class Page < ApplicationRecord
  attr_accessor :rationale

  belongs_to :created_by, class_name: "User", optional: true

  has_many :versions, class_name: "PageVersion", dependent: :destroy
  has_many :page_coordinators, dependent: :destroy
  has_many :coordinators, through: :page_coordinators, source: :user

  after_create :create_initial_version

  validate :friendly_validations
  validate :slug_format_check, if: -> { slug.present? }
  validate :slug_uniqueness_check, if: -> { slug.present? && section_slug.present? }
  validate :section_slug_matches_config

  scope :ordered, -> { order(:position, :title) }

  def path
    "#{section_slug}/#{slug}"
  end

  def create_initial_version
    versions.create!(title: title, content: content, version_number: 1, rationale: rationale, user: created_by)
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

  def friendly_validations
    errors.add(:base, "You must enter a page title.") if title.blank?
    errors.add(:base, "You must enter a page slug.") if slug.blank?
    errors.add(:base, "You must select a section.") if section_slug.blank?
  end

  def slug_format_check
    unless slug.match?(/\A[a-z0-9][a-z0-9-]*\z/)
      errors.add(:base, "Slug must start with a letter or number and contain only lowercase letters, numbers, and hyphens.")
    end
  end

  def slug_uniqueness_check
    scope = self.class.where(section_slug: section_slug, slug: slug)
    scope = scope.where.not(id: id) if persisted?
    if scope.exists?
      errors.add(:base, "A page with this slug already exists in this section.")
    end
  end

  def section_slug_matches_config
    return if section_slug.blank?

    allowed = self.class.valid_section_slugs
    return if allowed.empty? # tests / bootstrapping

    unless allowed.include?(section_slug)
      errors.add(:base, "The selected section is not valid.")
    end
  end
end
