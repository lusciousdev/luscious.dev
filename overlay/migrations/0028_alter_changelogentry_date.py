# Generated by Django 4.2.11 on 2024-08-13 03:06

import datetime
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('overlay', '0027_alter_changelogentry_date'),
    ]

    operations = [
        migrations.AlterField(
            model_name='changelogentry',
            name='date',
            field=models.DateTimeField(default=datetime.datetime(2024, 8, 12, 22, 6, 58, 285248)),
        ),
    ]
