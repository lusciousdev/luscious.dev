# Generated by Django 5.2.1 on 2025-06-14 21:28

import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('overlay', '0056_alter_countdownitem_timer_end'),
    ]

    operations = [
        migrations.AlterField(
            model_name='countdownitem',
            name='timer_end',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
    ]
