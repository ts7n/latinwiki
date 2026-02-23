# frozen_string_literal: true

class LinkPreviewsController < ApplicationController
  def show
    path = params[:path].to_s.strip.delete_prefix("/")
    return head :bad_request if path.blank?

    title = resolve_title(path)
    render json: { title: title }
  end

  private

  def resolve_title(path)
    if path.match?(/\Au\/[^\/]+\z/)
      username = path.delete_prefix("u/")
      user = User.find_by_username(username)
      user ? (user.name.presence || user.username) : nil
    else
      resolve_page_title(path)
    end
  end

  def resolve_page_title(path_str)
    return nil if path_str.blank?

    segments = path_str.split("/").reject(&:blank?)
    return nil if segments.empty?

    section_slugs = (Rails.application.config.wiki_sections || []).map { |s| (s[:slug] || s["slug"]).to_s }
    return nil if segments.size == 1 && section_slugs.include?(segments.first)

    page = Page.find_by_path(path_str) if Page.table_exists?
    return page.title if page

    slug = segments.last
    file_path = Rails.root.join("app", "docs", "#{slug}.md")
    return nil unless File.exist?(file_path)

    content = File.read(file_path)
    content.lines.first.to_s.sub(/\A#+\s*/, "").strip.presence || slug.titleize
  end
end
