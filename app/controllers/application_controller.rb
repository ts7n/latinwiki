class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern
  helper_method :current_user, :admin?, :can_create_page?, :pages_for_sidebar, :wiki_sections, :wiki_createable_sections

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes

  def current_user
    @current_user ||= User.find_by(id: session[:user_id])
  end

  def admin?
    current_user&.admin?
  end

  def can_create_page?
    admin? || current_user&.email&.end_with?("@latinschool.org")
  end

  def wiki_sections
    @wiki_sections ||= (Rails.application.config.wiki_sections || []).map(&:deep_symbolize_keys)
  end

  def wiki_createable_sections
    wiki_sections.select { |s| s[:createable] != false && s["createable"] != false }
  end

  def pages_for_sidebar
    @pages_for_sidebar ||= if Page.table_exists? && Page.any?
      Page.for_sidebar
    else
      Dir.glob(Rails.root.join("app/docs/*.md")).sort.map do |file|
        slug = File.basename(file, ".md")
        content = File.read(file)
        title = content.lines.first.to_s.sub(/\A#+\s*/, "").strip.presence || slug.titleize
        OpenStruct.new(title: title, slug: slug, id: nil, children: [])
      end
    end
  end
end
