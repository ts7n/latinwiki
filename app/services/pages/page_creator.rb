# frozen_string_literal: true

module Pages
  class PageCreator
    Result = Struct.new(:success, :page, :redirect_path, :notice, :alert, :edit_locals, keyword_init: true)

    def initialize(wiki_sections:, page_params:, is_admin: false, created_by: nil)
      @wiki_sections = wiki_sections
      @page_params = page_params
      @is_admin = is_admin
      @created_by = created_by
    end

    def call
      section_slug = @page_params[:section].presence
      title = @page_params[:title].to_s.strip
      content = @page_params[:content].to_s
      rationale = @page_params[:rationale].to_s.strip.presence
      custom_slug = @page_params[:slug].to_s.strip.presence
      unlisted = @is_admin && @page_params[:unlisted] == "1"

      if section_slug.blank?
        return Result.new(
          success: false,
          alert: "You must select a section.",
          edit_locals: edit_locals_for_failure(content, creating: true)
        )
      end

      if title.blank?
        return Result.new(
          success: false,
          alert: "You must enter a page title.",
          edit_locals: edit_locals_for_failure(content, creating: true)
        )
      end

      slug = if custom_slug.present?
        custom_slug.parameterize.presence || title.parameterize.presence || "page"
      else
        title.parameterize.presence || "page"
      end

      if section_slug.present?
        section_config = @wiki_sections.find { |s| s[:slug].to_s == section_slug }
        if section_config && (section_config[:createable] == false || section_config["createable"] == false)
          return Result.new(
            success: false,
            alert: "You cannot create pages in that section.",
            edit_locals: edit_locals_for_failure(content, creating: true)
          )
        end

        if section_config && (section_config[:unlisted] == true || section_config["unlisted"] == true)
          unlisted = true
        end
      end

      page = Page.new(title: title, slug: slug, content: content, section_slug: section_slug, unlisted: unlisted, created_by: @created_by)
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
