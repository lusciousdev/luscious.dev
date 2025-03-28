# Generated by Django 5.1.1 on 2025-01-19 19:25

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('overlay', '0040_remove_canvasitem_history_canvasaction'),
    ]

    operations = [
        migrations.AddField(
            model_name='audioitem',
            name='position_lock',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='canvasitem',
            name='position_lock',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='counteritem',
            name='position_lock',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='embeditem',
            name='position_lock',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='imageitem',
            name='position_lock',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='stopwatchitem',
            name='position_lock',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='textitem',
            name='position_lock',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='twitchstreamembeditem',
            name='position_lock',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='twitchvideoembeditem',
            name='position_lock',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='youtubeembeditem',
            name='position_lock',
            field=models.BooleanField(default=False),
        ),
    ]
