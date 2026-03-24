# frozen_string_literal: true

module Pages
  # Builds a Diffy diff between two page versions for the diff view.
  class VersionDiffBuilder
    def initialize(page:, version_number:, with_param:)
      @page = page
      @version_number = version_number
      @with_param = with_param
    end

    # Returns { success: true, version:, diff:, diff_label: } or { success: false, alert: }
    def call
      unless @page.is_a?(Page)
        return { success: false, alert: "Version history not available for file-based pages." }
      end

      version = @page.versions.find_by(version_number: @version_number)
      return { success: false, alert: "Version not found." } unless version

      case @with_param
      when "prev"
        other_version = @page.versions.find_by(version_number: version.version_number - 1)
        other_content = other_version&.content || ""
        from_content = other_content
        to_content = version.content
        diff_label = "v#{other_version&.version_number || "?"} → v#{version.version_number}"
      when "current"
        other_content = @page.content
        from_content = version.content
        to_content = other_content
        diff_label = "v#{version.version_number} → current"
      else
        return { success: false, alert: "Invalid diff." }
      end

      diff = Diffy::Diff.new(
        DiffNormalizer.call(from_content),
        DiffNormalizer.call(to_content)
      )

      { success: true, version: version, diff: diff, diff_label: diff_label }
    end
  end
end
