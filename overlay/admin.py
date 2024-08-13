from django.contrib import admin

from .models import *

class ChangeLogEntryAdmin(admin.ModelAdmin):
  fields = ("title", "description", "date")
  ordering = ( "-date", )

# Register your models here.
admin.site.register(ChangeLogEntry, ChangeLogEntryAdmin)