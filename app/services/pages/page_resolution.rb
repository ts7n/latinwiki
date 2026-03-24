# frozen_string_literal: true

module Pages
  # Result of resolving a wiki path to a DB page, file-backed page, redirect, or 404.
  class PageResolution
    attr_reader :page, :redirect_path

    def initialize(page: nil, not_found: false, redirect_path: nil)
      @page = page
      @not_found = not_found
      @redirect_path = redirect_path
    end

    def redirect_to_doc?
      redirect_path.present?
    end

    def not_found?
      @not_found
    end

    def self.redirect_to_doc(path) = new(redirect_path: path.to_s.presence)
    def self.missing = new(not_found: true)
    def self.found(page) = new(page: page)
  end
end
