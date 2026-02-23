# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).

return unless Page.table_exists?

sections = Rails.application.config.wiki_sections || []
seed_pages = Rails.application.config.wiki_seed_pages || []

# Create section pages (sidebar/URL containers)
sections.each_with_index do |section, index|
  section = section.deep_symbolize_keys
  Page.find_or_create_by!(slug: section[:slug], parent_id: nil) do |p|
    p.title = section[:name] || section[:slug].to_s.titleize
    p.content = ""
    p.position = index
  end
end

# Create seed pages under their sections
seed_pages.each_with_index do |page_config, index|
  page_config = page_config.deep_symbolize_keys
  parent = Page.root_pages.find_by(slug: page_config[:section])
  next unless parent

  Page.find_or_create_by!(slug: page_config[:slug], parent: parent) do |p|
    p.title = page_config[:title] || page_config[:slug].to_s.titleize
    p.content = page_config[:content].to_s
    p.parent = parent
    p.position = index
  end
end

# Ensure all pages have at least one version (for pages created before versions existed)
if PageVersion.table_exists?
  Page.find_each do |page|
    next if page.versions.any?

    page.versions.create!(title: page.title, content: page.content, version_number: 1)
  end
end
