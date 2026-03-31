# frozen_string_literal: true

require "ostruct"

class PagesController < ApplicationController
  include Pages::AuditLogging

  before_action :skip_set_page_for_new, only: [ :edit ]
  before_action :set_page, only: [ :show, :edit, :update, :diff, :history, :destroy ]
  after_action :log_audit, only: [ :create, :update, :destroy ]

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
      unless can_create_page?
        redirect_to root_path
        return
      end
      @content_html = ""
      @pages_for_sidebar = pages_for_sidebar
      return
    end
    unless @page.is_a?(Page)
      redirect_to doc_path(path: @page.path), alert: "Cannot edit file-based pages."
      return
    end

    merge_state = Pages::MergeEditState.assign_for(
      page: @page,
      page_content: page_content,
      merge_draft: session[:merge_draft]
    )
    merge_state.each { |key, value| instance_variable_set("@#{key}", value) }

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
    result = Pages::VersionDiffBuilder.new(
      page: @page,
      version_number: params[:v],
      with_param: params[:with]
    ).call

    unless result[:success]
      redirect_to doc_path(path: @page.path), alert: result[:alert]
      return
    end

    @version = result[:version]
    @diff = result[:diff]
    @diff_label = result[:diff_label]
    @pages_for_sidebar ||= pages_for_sidebar
  end

  def create
    unless can_create_page?
      redirect_to root_path
      return
    end

    result = Pages::PageCreator.new(
      wiki_sections: wiki_sections,
      page_params: page_params_for_create,
      is_admin: admin?,
      created_by: current_user
    ).call

    if result.success
      @created_page_path = result.page.path
      @created_page_title = result.page.title
      redirect_to doc_path(path: result.redirect_path), notice: result.notice, status: :see_other
    else
      result.edit_locals.each { |key, value| instance_variable_set("@#{key}", value) }
      @pages_for_sidebar = pages_for_sidebar
      flash.now[:alert] = result.alert
      render :edit, status: :unprocessable_entity
    end
  end

  def update
    if @page.is_a?(Page)
      base_version = page_params_for_update[:base_version].to_i
      current_version = @page.versions.maximum(:version_number).to_i
      resolving = params[:resolve] == "1"

      unless resolving
        if base_version > 0 && base_version < current_version
          Pages::MergeConflictDraft.store!(session, page: @page, page_params: page_params_for_update)
          redirect_to edit_doc_path(helpers.edit_doc_query(@page.path)), status: :see_other
          return
        end
      end

      old_path = @page.path
      @page.title = page_params_for_update[:title]
      @page.content = page_params_for_update[:content]

      if can_create_page?
        new_section = page_params_for_update[:section_slug]
        @page.section_slug = new_section if new_section.present?

        new_slug = page_params_for_update[:slug]
        if new_slug.present?
          @page.slug = new_slug.parameterize.presence || @page.slug
        end
      end

      if admin?
        @page.unlisted = page_params_for_update[:unlisted] == "1"
      end

      if @page.save
        rationale = page_params_for_update[:rationale].to_s.strip.presence
        @page.versions.create!(
          title: @page.title,
          content: @page.content,
          version_number: @page.versions.maximum(:version_number).to_i + 1,
          user: current_user,
          rationale: rationale
        )
        session.delete(:merge_draft) if session[:merge_draft]&.dig("path") == old_path
        redirect_to doc_path(path: @page.path), notice: "Page updated."
      else
        flash.now[:alert] = @page.errors.full_messages.to_sentence
        @edit_title = @page.title
        @edit_rationale = page_params_for_update[:rationale]
        @content_html = WikiMarkdown.render(@page.content || "")[:html]
        @base_version = @page.versions.maximum(:version_number)
        @pages_for_sidebar = pages_for_sidebar
        render :edit, status: :unprocessable_entity
      end
    else
      redirect_to doc_path(path: @page.path), alert: "Cannot edit file-based pages."
    end
  end

  def destroy
    unless can_delete_page?(@page)
      redirect_to root_path
      return
    end
    unless @page.is_a?(Page)
      redirect_to root_path, alert: "Cannot delete file-based pages."
      return
    end
    @page.destroy
    redirect_to root_path, notice: %(Page "#{@page.title}" deleted.), status: :see_other
  end

  private

  def page_params_for_create
    params.require(:page).permit(:section, :title, :content, :rationale, :slug, :unlisted)
  end

  def page_params_for_update
    params.require(:page).permit(:title, :content, :rationale, :base_version, :section_slug, :slug, :unlisted)
  end

  def skip_set_page_for_new
    if params[:new] == "1"
      @creating = true
      @page = OpenStruct.new(path: "", title: "", content: "", slug: "", unlisted: false)
      return
    end
  end

  def set_page
    return if @creating

    path_str = resolved_path_str

    resolution = Pages::PageResolver.new(
      path_str: path_str,
      wiki_sections: Rails.application.config.wiki_sections || [],
      table_exists: Page.table_exists?
    ).call

    if resolution.redirect_to_doc?
      redirect_to doc_path(path: resolution.redirect_path), status: :see_other
      return
    end
    if resolution.not_found?
      @pages_for_sidebar = pages_for_sidebar
      render "pages/not_found", status: :not_found
      return
    end

    @page = resolution.page
  end

  def resolved_path_str
    path_str = if params[:cat].present? || params[:pg].present?
      [ params[:cat], params[:pg] ].compact.join("/")
    else
      params[:path]
    end
    path_str.presence || Rails.application.config.wiki_default_path
  end

  def page_content
    @page.content
  end
end
