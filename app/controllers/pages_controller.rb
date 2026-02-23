# frozen_string_literal: true

require "ostruct"

class PagesController < ApplicationController
  before_action :skip_set_page_for_new, only: [ :edit ]
  before_action :set_page, only: [ :show, :edit, :update, :diff, :history ]

  def show
    @page = Page.includes(:coordinators).find(@page.id) if @page.is_a?(Page) && @page.id
    if @page
      rendered = WikiMarkdown.render(page_content)
      @content = rendered[:html]
      @sections = rendered[:sections]
    end

    @pages_for_sidebar = pages_for_sidebar
  end

  def edit
    unless current_user
      render "shared/permission_missing", status: :forbidden, layout: "application"
      return
    end
    if @creating
      @content_html = ""
      @pages_for_sidebar = pages_for_sidebar
      return
    end
    unless @page.is_a?(Page)
      redirect_to doc_path(path: @page.path), alert: "Cannot edit file-based pages."
      return
    end
    if session[:merge_draft].present? && session[:merge_draft]["path"] == @page.path
      draft = session[:merge_draft]
      @merge_conflict = true
      @content_html = WikiMarkdown.render(@page.content)[:html]
      @edit_title = @page.title
      @edit_rationale = nil
      @merge_draft_content = draft["content"].to_s
      @merge_draft_title = draft["title"].to_s
      @merge_draft_rationale = draft["rationale"].to_s
      @merge_diff = Diffy::Diff.new(normalize_for_diff(@page.content), normalize_for_diff(@merge_draft_content))
    else
      @merge_conflict = false
      @content_html = WikiMarkdown.render(page_content)[:html]
      @edit_title = @page.title
      @edit_rationale = nil
    end
    @base_version = @page.versions.maximum(:version_number)
    @pages_for_sidebar = pages_for_sidebar
  end

  def history
    @page = Page.includes(:coordinators).find(@page.id) if @page.is_a?(Page) && @page.id
    unless @page.is_a?(Page)
      redirect_to doc_path(path: @page.path), alert: "Version history not available for file-based pages."
      return
    end
    @versions = @page.versions.recent
    @current_version = @page.versions.maximum(:version_number)
    @pages_for_sidebar = pages_for_sidebar
  end

  def diff
    unless @page.is_a?(Page)
      redirect_to doc_path(path: @page.path), alert: "Version history not available for file-based pages."
      return
    end
    @version = @page.versions.find_by(version_number: params[:v])
    unless @version
      redirect_to doc_path(path: @page.path), alert: "Version not found."
      return
    end
    case params[:with]
    when "prev"
      @other_version = @page.versions.find_by(version_number: @version.version_number - 1)
      @other_content = @other_version&.content || ""
      @other_label = @other_version ? "v#{@other_version.version_number} (prev)" : "(none)"
    when "current"
      @other_content = @page.content
      @other_label = "current (newest)"
    else
      redirect_to doc_path(path: @page.path), alert: "Invalid diff."
      return
    end
    if params[:with] == "prev"
      from_content = @other_content
      to_content = @version.content
      @diff_label = "v#{@other_version&.version_number || "?"} → v#{@version.version_number}"
    else
      from_content = @version.content
      to_content = @other_content
      @diff_label = "v#{@version.version_number} → current"
    end
    @diff = Diffy::Diff.new(normalize_for_diff(from_content), normalize_for_diff(to_content))
    @pages_for_sidebar ||= pages_for_sidebar
  end

  def create
    unless current_user
      redirect_to edit_doc_path(new: "1"), alert: "Sign in to create a page."
      return
    end
    section_slug = params[:page][:section].presence
    title = params[:page][:title].to_s.strip
    content = params[:page][:content].to_s
    rationale = params[:page][:rationale].to_s.strip.presence

    if title.blank?
      @creating = true
      @content_html = content.blank? ? "" : WikiMarkdown.render(content)[:html]
      @pages_for_sidebar = pages_for_sidebar
      flash.now[:alert] = "Title is required."
      render :edit, status: :unprocessable_entity
      return
    end

    slug = title.parameterize.presence || "page"
    parent = nil
    if section_slug.present?
      section_config = wiki_sections.find { |s| s[:slug].to_s == section_slug }
      if section_config && (section_config[:createable] == false || section_config["createable"] == false)
        @creating = true
        @content_html = content.blank? ? "" : WikiMarkdown.render(content)[:html]
        @pages_for_sidebar = pages_for_sidebar
        flash.now[:alert] = "You cannot create pages in that section."
        render :edit, status: :unprocessable_entity
        return
      end
      parent = Page.root_pages.find_by(slug: section_slug) if Page.table_exists?
      unless parent
        section_title = section_config&.dig(:name) || section_slug.titleize
        parent = Page.create!(slug: section_slug, title: section_title, content: "")
      end
    end

    page = Page.new(title: title, slug: slug, content: content, parent: parent)
    page.rationale = rationale
    if page.save
      redirect_to doc_path(path: page.path), notice: "Page published.", status: :see_other
    else
      @creating = true
      @content_html = content.blank? ? "" : WikiMarkdown.render(content)[:html]
      @pages_for_sidebar = pages_for_sidebar
      flash.now[:alert] = page.errors.full_messages.to_sentence
      render :edit, status: :unprocessable_entity
    end
  end

  def update
    if @page.is_a?(Page)
      base_version = params[:page][:base_version].to_i
      current_version = @page.versions.maximum(:version_number).to_i
      resolving = params[:resolve] == "1"

      unless resolving
        if base_version > 0 && base_version < current_version
          prepare_merge_conflict
          return
        end
      end

      @page.title = params[:page][:title]
      @page.content = params[:page][:content]
      if @page.save
        rationale = params[:page][:rationale].to_s.strip.presence
        @page.versions.create!(
          title: @page.title,
          content: @page.content,
          version_number: @page.versions.maximum(:version_number).to_i + 1,
          user: current_user,
          rationale: rationale
        )
        session.delete(:merge_draft) if session[:merge_draft]&.dig("path") == @page.path
        redirect_to doc_path(path: @page.path), notice: "Page updated."
      else
        @pages_for_sidebar = pages_for_sidebar
        render :edit
      end
    else
      redirect_to doc_path(path: @page.path), alert: "Cannot edit file-based pages."
    end
  end

  private

  def skip_set_page_for_new
    if params[:new] == "1"
      @creating = true
      @page = OpenStruct.new(path: "", title: "", content: "")
      return
    end
  end

  def set_page
    return if @creating

    path_str = if params[:cat].present? || params[:pg].present?
      [ params[:cat], params[:pg] ].compact.join("/")
    else
      params[:path]
    end
    path_str = path_str.presence || Rails.application.config.wiki_default_path

    # Sections are not pages; bare /[section] URLs redirect to root
    segments = path_str.to_s.split("/").reject(&:blank?)
    section_slugs = (Rails.application.config.wiki_sections || []).map { |s| (s[:slug] || s["slug"]).to_s }
    if segments.size == 1 && section_slugs.include?(segments.first)
      redirect_to root_path and return
    end

    @page = Page.find_by_path(path_str) if Page.table_exists?

    unless @page
      slug = path_str.to_s.split("/").last
      @page = load_page_from_file(slug)
      if @page
        @page.define_singleton_method(:path) { slug }
      else
        @pages_for_sidebar = pages_for_sidebar
        render "pages/not_found", status: :not_found
      end
    end
  end

  def page_content
    @page.content
  end

  def load_page_from_file(slug)
    file_path = Rails.root.join("app", "docs", "#{slug}.md")
    return nil unless File.exist?(file_path)

    content = File.read(file_path)
    title = content.lines.first.to_s.sub(/\A#+\s*/, "").strip.presence || slug.titleize
    OpenStruct.new(title: title, slug: slug, content: content, id: nil)
  end

  def require_user
    redirect_to doc_path(path: @page.path), alert: "Sign in to edit." unless current_user
  end

  def prepare_merge_conflict
    session[:merge_draft] = {
      "path" => @page.path,
      "title" => params[:page][:title],
      "content" => params[:page][:content],
      "rationale" => params[:page][:rationale]
    }
    redirect_to edit_doc_path(helpers.edit_doc_query(@page.path)), status: :see_other
  end

  # Normalizes content before diffing: collapses redundant blank lines (3+ → 2),
  # trims whitespace-only lines to empty, and strips leading/trailing blank lines.
  def normalize_for_diff(content)
    content.to_s
      .lines(chomp: true)
      .map { |line| line.match(/\A\s*\z/) ? "" : line }
      .join("\n")
      .gsub(/\n{3,}/, "\n\n")
      .strip
  end
end
