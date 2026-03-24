# frozen_string_literal: true

require "ostruct"

module Pages
  # Resolves URL path segments to a Page record or a file-backed OpenStruct.
  class PageResolver
    def initialize(path_str:, wiki_sections:, table_exists:)
      @path_str = path_str.to_s
      @wiki_sections = wiki_sections
      @table_exists = table_exists
    end

    def call
      segments = @path_str.split("/").reject(&:blank?)
      section_slugs = (@wiki_sections || []).map { |s| (s[:slug] || s["slug"]).to_s }

      if segments.size == 1 && section_slugs.include?(segments.first)
        return first_page_in_section_redirect(segments.first)
      end

      page = Page.find_by_path(@path_str) if @table_exists

      unless page
        slug = @path_str.split("/").last
        file_page = load_page_from_file(slug)
        return PageResolution.missing unless file_page

        file_page.define_singleton_method(:path) { slug }
        return PageResolution.found(file_page)
      end

      PageResolution.found(page)
    end

    private

    # /[section] → first page in that section (navbar order: position, then title).
    def first_page_in_section_redirect(section_slug)
      unless @table_exists
        return PageResolution.missing
      end

      first = Page.where(section_slug: section_slug).ordered.first
      return PageResolution.missing if first.blank?

      PageResolution.redirect_to_doc(first.path)
    end

    def load_page_from_file(slug)
      file_path = Rails.root.join("app", "docs", "#{slug}.md")
      return nil unless File.exist?(file_path)

      content = File.read(file_path)
      title = content.lines.first.to_s.sub(/\A#+\s*/, "").strip.presence || slug.titleize
      OpenStruct.new(title: title, slug: slug, content: content, id: nil)
    end
  end
end
