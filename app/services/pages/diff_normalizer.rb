# frozen_string_literal: true

module Pages
  # Normalizes content before diffing: collapses redundant blank lines (3+ → 2),
  # trims whitespace-only lines to empty, and strips leading/trailing blank lines.
  class DiffNormalizer
    def self.call(content)
      content.to_s
        .lines(chomp: true)
        .map { |line| line.match(/\A\s*\z/) ? "" : line }
        .join("\n")
        .gsub(/\n{3,}/, "\n\n")
        .strip
    end
  end
end
