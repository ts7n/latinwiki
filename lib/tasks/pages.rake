# frozen_string_literal: true

namespace :pages do
  desc "Import pages from app/docs/*.md into the database (WIKI_IMPORT_SECTION=meta)"
  task import_from_files: :environment do
    docs_dir = Rails.root.join("app/docs")
    unless Dir.exist?(docs_dir)
      puts "No app/docs directory found."
      exit
    end

    section_slug = ENV.fetch("WIKI_IMPORT_SECTION", "meta").to_s.strip
    unless Page.valid_section_slugs.include?(section_slug)
      puts "Invalid WIKI_IMPORT_SECTION=#{section_slug.inspect}. Valid: #{Page.valid_section_slugs.join(', ')}"
      exit 1
    end

    Dir.glob(docs_dir.join("*.md")).sort.each_with_index do |file, index|
      slug = File.basename(file, ".md")
      content = File.read(file)
      title = content.lines.first.to_s.sub(/\A#+\s*/, "").strip.presence || slug.titleize

      page = Page.find_or_initialize_by(slug: slug, section_slug: section_slug)
      page.title = title
      page.content = content
      page.position = index
      page.save!
      puts "Imported: #{section_slug}/#{slug}"
    end

    puts "Done. #{Page.count} page(s) in database."
  end
end
