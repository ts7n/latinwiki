# LatinWiki

A simple wiki platform with hierarchical pages, Google OAuth sign-in, page versioning with diffs, editable user profiles, and a TipTap rich-text editor. Designed for school communities, but highly versatile.

## Configuration

Edit [`config/wiki.yml`](config/wiki.yml) before deploying:

| Key | Purpose |
| --- | --- |
| `wiki_name` | Site name shown in sidebar, titles, and mobile header |
| `accent_color` | CSS color for the top accent bar |
| `user_domains` | Email domains allowed to sign in via Google |
| `moderator_domains` | Subset of `user_domains` that may create pages (admins always can) |
| `role_labels` | Display labels by email domain (e.g. `latinschool.org: "Faculty/Staff"`) |
| `sections` | Sidebar sections: `slug`, `name`, and `createable` (true/false) |
| `default_path` | Where `/` redirects (e.g. `meta/introduction`) |
| `sign_in_required_message` | Body text on the sign-in-required page (HTML, sanitized) |
| `unauthorized_domain_message` | Flash message when a disallowed email domain tries to sign in |

Individual emails outside `user_domains` (e.g. alumni) can be allowlisted via the `allowed_emails` database table.

## Setup

Create a Google OAuth **Web** client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Set the redirect URI to your base URL + `/auth/google_oauth2/callback`.

```bash
git clone https://github.com/ts7n/latinwiki.git
cd latinwiki
bundle install
bin/rails credentials:edit      # add google.client_id and google.client_secret
cp .env.example .env            # paste the contents of config/master.key as RAILS_MASTER_KEY
docker compose up --build
docker compose exec web bin/rails db:seed
```

By default, the app runs on port `3000`.