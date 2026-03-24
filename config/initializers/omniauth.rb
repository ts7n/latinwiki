# Prefer ENV on hosts like Heroku; fall back to encrypted credentials locally.
Rails.application.config.middleware.use OmniAuth::Builder do
  client_id = ENV["GOOGLE_CLIENT_ID"].presence || Rails.application.credentials.dig(:google, :client_id)
  client_secret = ENV["GOOGLE_CLIENT_SECRET"].presence || Rails.application.credentials.dig(:google, :client_secret)
  provider :google_oauth2, client_id, client_secret
end