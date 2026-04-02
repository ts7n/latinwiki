// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import "@hotwired/turbo-rails"
import "controllers"
import posthog from "posthog-js"

posthog.init('phc_xiDq5jaDS7kEuFQAdVXc9i4WL6KvPBsNRhGNMMESZFgJ', {
    api_host: 'https://phproxy.tlampert.net',
    defaults: '2026-01-30'
})
