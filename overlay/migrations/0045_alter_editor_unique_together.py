# Generated by Django 5.1.1 on 2025-02-09 06:58

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('overlay', '0044_editor_id_type'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='editor',
            unique_together={('owner', 'id_type', 'identifier')},
        ),
    ]
