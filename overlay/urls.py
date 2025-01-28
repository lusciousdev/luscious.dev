from django.urls import path

from . import views
from . import api

from asgiref.sync import sync_to_async, async_to_sync, markcoroutinefunction, iscoroutinefunction

app_name = 'overlay'
urlpatterns = [
  path("", views.HomeView.as_view(), name="home"),
  path("changelog/", views.ChangeLogView.as_view(), name="change_log"),
  path("create/", views.create_overlay, name="create_overlay"),
  path("profile/", views.ProfileView.as_view(), name="profile"),
  path("edit/<str:pk>/", views.EditOverlayView.as_view(), name="edit_overlay"),
  path("view/<str:pk>/", sync_to_async(views.view_overlay), name="view_overlay"),
  path("api/getitems/", api.get_overlay_items, name = "api_get_overlay_items"),
  path("api/additem/", api.add_overlay_item, name = "api_add_overlay_item"),
  path("api/edititem/", api.edit_overlay_item, name = "api_edit_overlay_item"),
  path("api/edititems/", api.edit_overlay_items, name = "api_edit_overlay_items"),
  path("api/deleteitem/", api.delete_overlay_item, name = "api_delete_overlay_item"),
]