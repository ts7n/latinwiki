require "test_helper"

class PagesControllerTest < ActionDispatch::IntegrationTest
  test "should get show" do
    get doc_path(path: Rails.application.config.wiki_default_path)
    assert_response :success
  end
end
