# frozen_string_literal: true

class SearchController < ApplicationController
  def index
    @query = params[:q].to_s.strip
    @mode = params[:mode].presence || "pages"
    @mode = "pages" unless current_user # People search requires sign-in

    if @query.present?
      if @mode == "people"
        @people = current_user ? search_people(@query) : []
      else
        @pages = search_pages(@query)
      end
    else
      @people = []
      @pages = []
    end
  end

  private

  def search_pages(query)
    return [] unless Page.table_exists?
    return [] if query.blank?

    words = query.split(/\s+/).map(&:strip).reject { |w| w.length < 2 }
    words = [ query ] if words.empty?

    conditions = words.map do |word|
      "(LOWER(title) LIKE LOWER(?) OR LOWER(content) LIKE LOWER(?))"
    end
    binds = words.flat_map { |w| term = "%#{Page.sanitize_sql_like(w)}%"; [ term, term ] }

    base = Page.where(conditions.join(" AND "), *binds)

    exact = query.downcase
    title_term = "%#{Page.sanitize_sql_like(query)}%"
    base.order(
      Arel.sql("CASE
        WHEN LOWER(title) = #{Page.connection.quote(exact)} THEN 0
        WHEN LOWER(title) LIKE LOWER(#{Page.connection.quote(title_term)}) THEN 1
        ELSE 2
      END, title")
    ).limit(50)
  end

  def search_people(query)
    return [] unless User.table_exists?
    return [] if query.blank?

    words = query.split(/\s+/).map(&:strip).reject { |w| w.length < 2 }
    words = [ query ] if words.empty?

    conditions = words.map do |word|
      "(LOWER(COALESCE(email, '')) LIKE LOWER(?)
        OR LOWER(COALESCE(name, '')) LIKE LOWER(?)
        OR LOWER(COALESCE(description, '')) LIKE LOWER(?)
        OR LOWER(COALESCE(profile_content, '')) LIKE LOWER(?))"
    end
    binds = words.flat_map { |w| term = "%#{User.sanitize_sql_like(w)}%"; [ term, term, term, term ] }

    User.where(conditions.join(" AND "), *binds).limit(50).to_a
  end
end
