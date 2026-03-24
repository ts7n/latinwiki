# frozen_string_literal: true

module Pages
  # Assigns edit view ivars for merge-conflict vs normal edit flows.
  class MergeEditState
    def self.assign_for(page:, page_content:, merge_draft:)
      if merge_draft.present? && merge_draft["path"] == page.path
        draft = merge_draft
        {
          merge_conflict: true,
          content_html: WikiMarkdown.render(page.content)[:html],
          edit_title: page.title,
          edit_rationale: nil,
          merge_draft_content: draft["content"].to_s,
          merge_draft_title: draft["title"].to_s,
          merge_draft_rationale: draft["rationale"].to_s,
          merge_diff: Diffy::Diff.new(
            DiffNormalizer.call(page.content),
            DiffNormalizer.call(draft["content"].to_s)
          )
        }
      else
        {
          merge_conflict: false,
          content_html: WikiMarkdown.render(page_content)[:html],
          edit_title: page.title,
          edit_rationale: nil
        }
      end
    end
  end
end
