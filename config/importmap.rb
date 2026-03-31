# Pin npm packages by running ./bin/importmap

pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin_all_from "app/javascript/controllers", under: "controllers"

pin "@tiptap/core", to: "https://esm.sh/@tiptap/core@2"
pin "@tiptap/starter-kit", to: "https://esm.sh/@tiptap/starter-kit@2"
pin "@tiptap/extension-link", to: "https://esm.sh/@tiptap/extension-link@2"
pin "@tiptap/extension-table", to: "https://esm.sh/@tiptap/extension-table@2"
pin "@tiptap/extension-table-row", to: "https://esm.sh/@tiptap/extension-table-row@2"
pin "@tiptap/extension-table-cell", to: "https://esm.sh/@tiptap/extension-table-cell@2"
pin "@tiptap/extension-table-header", to: "https://esm.sh/@tiptap/extension-table-header@2"
pin "turndown", to: "https://esm.sh/turndown@7"
pin "turndown-plugin-gfm", to: "https://esm.sh/turndown-plugin-gfm@1"
pin "katex", to: "https://esm.sh/katex@0.16"
