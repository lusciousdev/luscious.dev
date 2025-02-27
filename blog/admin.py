from django.contrib import admin

from .models import *

# Register your models here.


class BlogEntryAdmin(admin.ModelAdmin):
  fields = ("title", "content", "slug")
  ordering = ( "-created_at", )

# Register your models here
admin.site.register(Blog, BlogEntryAdmin)