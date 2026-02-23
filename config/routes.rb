Rails.application.routes.draw do
  # Content
  root to: redirect("/#{Rails.application.config.wiki_default_path}")
  get "auth/google_oauth2/callback", to: "sessions#create"
  get "auth/failure", to: "sessions#failure"
  delete "logout", to: "sessions#destroy"
  get "u/:username", to: "users#show", as: :user
  patch "u/:username", to: "users#update"
  get "edit", to: "users#edit", as: :edit_profile, constraints: ->(req) { req.query_parameters["special"] == "myprofile" }
  get "edit", to: "pages#edit", as: :edit_doc
  post "pages", to: "pages#create", as: :pages
  get "diff", to: "pages#diff", as: :diff_doc
  get "history", to: "pages#history", as: :history_doc
  get "search", to: "search#index", as: :search
  get "api/link_preview", to: "link_previews#show"
  delete "*path", to: "pages#destroy"
  patch "*path", to: "pages#update"
  get "*path", to: "pages#show", as: :doc
end
