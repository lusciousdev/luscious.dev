from django.urls import path

from . import views
from . import api

app_name = 'overlay'
urlpatterns = [
  path("", views.IndexView.as_view(), name="index"),
  path("profile/", views.ProfileView.as_view(), name="profile"),
  path("profile/add_editor", views.add_editor, name="add_editor"),
  path("profile/remove_editor", views.remove_editor, name="remove_editor"),
  path("profile/create_overlay", views.create_overlay, name="create_overlay"),
  path("profile/delete_overlay", views.delete_overlay, name="delete_overlay"),
  path("edit/<str:pk>/", views.EditOverlayView.as_view(), name="edit_overlay"),
  path("view/<str:pk>/", views.ViewOverlayView.as_view(), name="view_overlay"),
  path("api/getitems", api.get_overlay_items, name = "api_get_overlay_items"),
  path("api/additem", api.add_overlay_item, name = "api_add_overlay_item"),
  path("api/edititem", api.edit_overlay_item, name = "api_edit_overlay_item"),
  path("api/edititems", api.edit_overlay_items, name = "api_edit_overlay_items"),
  path("api/deleteitem", api.delete_overlay_item, name = "api_delete_overlay_item"),
]