require_relative "boot"

require "rails/all"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Latinwiki
  class Application < Rails::Application
    wiki_config = (YAML.load_file(Rails.root.join("config/wiki_sections.yml")) || {}).deep_symbolize_keys
    config.wiki_sections = wiki_config[:sections] || []
    config.wiki_default_path = (wiki_config[:default_path] || "meta/introduction").to_s
    config.wiki_seed_pages = (wiki_config[:seed_pages] || []).map(&:deep_symbolize_keys)
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")
  end
end
