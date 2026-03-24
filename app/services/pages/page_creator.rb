# frozen_string_literal: true

module Pages
  # Handles POST /pages — new page under a section with validation.
  class PageCreator
    Result = Struct.new(:success, :page, :redirect_path, :notice, :alert, :edit_locals, keyword_init: true)

    def initialize(wiki_sections:, page_params:)
      @wiki_sections = wiki_sections
      @page_params = page_params
    end

    def call
      section_slug = @page_params[:section].presence
      title = @page_params[:title].to_s.strip
      content = @page_params[:content].to_s
      rationale = @page_params[:rationale].to_s.strip.presence

      if title.blank?
        return Result.new(
          success: false,
          alert: "Title is required.",
          edit_locals: edit_locals_for_failure(content, creating: true)
        )
      end

      slug = title.parameterize.presence || "page"

      if section_slug.present?
        section_config = @wiki_sections.find { |s| s[:slug].to_s == section_slug }
        if section_config && (section_config[:createable] == false || section_config["createable"] == false)
          return Result.new(
            success: false,
            alert: "You cannot create pages in that section.",
            edit_locals: edit_locals_for_failure(content, creating: true)
          )
        end
      end

      page = Page.new(title: title, slug: slug, content: content, section_slug: section_slug)
      page.rationale = rationale
      if page.save
        Result.new(success: true, page: page, redirect_path: page.path, notice: "Page published.")
      else
        Result.new(
          success: false,
          alert: page.errors.full_messages.to_sentence,
          edit_locals: edit_locals_for_failure(content, creating: true)
        )
      end
    end

    private

    def edit_locals_for_failure(content, creating:)
      content_html = content.blank? ? "" : WikiMarkdown.render(content)[:html]
      {
        creating: creating,
        content_html: content_html
      }
    end
  end
end
