# frozen_string_literal: true

module Pages
  # Stores submitted edit fields in session when a merge conflict must be resolved.
  class MergeConflictDraft
    def self.store!(session, page:, page_params:)
      session[:merge_draft] = {
        "path" => page.path,
        "title" => page_params[:title],
        "content" => page_params[:content],
        "rationale" => page_params[:rationale]
      }
    end
  end
end
