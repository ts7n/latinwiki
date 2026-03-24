# frozen_string_literal: true

class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern
  helper_method :current_user, :admin?, :can_create_page?, :pages_for_sidebar, :wiki_sections, :wiki_createable_sections,
                :wiki_name, :wiki_accent_color, :wiki_section_name, :wiki_sign_in_required_message

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes

  def current_user
    @current_user ||= User.find_by(id: session[:user_id])
  end

  def admin?
    current_user&.admin?
  end

  def can_create_page?
    return false unless current_user
    return true if admin?

    domain = current_user.email.to_s.split("@", 2).last
    Rails.application.config.wiki_moderator_domains.include?(domain)
  end

  def wiki_name
    Rails.application.config.wiki_name
  end

  def wiki_accent_color
    Rails.application.config.wiki_accent_color
  end

  def wiki_sign_in_required_message
    Rails.application.config.wiki_sign_in_required_message
  end

  def wiki_section_name(slug)
    s = wiki_sections.find { |sec| sec[:slug].to_s == slug.to_s }
    s&.dig(:name).presence || slug.to_s.titleize
  end

  def wiki_sections
    @wiki_sections ||= (Rails.application.config.wiki_sections || []).map(&:deep_symbolize_keys)
  end

  def wiki_createable_sections
    wiki_sections.select { |s| s[:createable] != false && s["createable"] != false }
  end

  def pages_for_sidebar
    @pages_for_sidebar ||= build_sidebar_pages
  end

  private

  def build_sidebar_pages
    sections = wiki_sections
    if Page.table_exists? && Page.any?
      sections.map do |s|
        s = s.deep_symbolize_keys
        slug = s[:slug].to_s
        {
          name: s[:name].presence || slug.titleize,
          slug: slug,
          pages: Page.where(section_slug: slug).ordered.to_a
        }
      end
    else
      first_slug = sections.first&.deep_symbolize_keys&.fetch(:slug, nil).presence || "meta"
      first_name = sections.first&.deep_symbolize_keys&.fetch(:name, nil).presence || "Pages"
      pages = Dir.glob(Rails.root.join("app/docs/*.md")).sort.map do |file|
        slug = File.basename(file, ".md")
        content = File.read(file)
        title = content.lines.first.to_s.sub(/\A#+\s*/, "").strip.presence || slug.titleize
        OpenStruct.new(
          title: title,
          slug: slug,
          id: nil,
          section_slug: first_slug,
          path: "#{first_slug}/#{slug}"
        )
      end
      [
        {
          name: first_name,
          slug: first_slug,
          pages: pages
        }
      ]
    end
  end
end
