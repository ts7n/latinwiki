# Pin npm packages by running ./bin/importmap

pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin_all_from "app/javascript/controllers", under: "controllers"

pin "@tiptap/core", to: "https://esm.sh/@tiptap/core@2"
pin "@tiptap/starter-kit", to: "https://esm.sh/@tiptap/starter-kit@2"
pin "@tiptap/extension-link", to: "https://esm.sh/@tiptap/extension-link@2"
pin "turndown", to: "https://esm.sh/turndown@7"
