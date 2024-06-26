# Generated by Django 4.2.11 on 2024-04-20 23:26

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('overlay', '0012_twitchstreamembeditem_volume_youtubeembeditem_volume'),
    ]

    operations = [
        migrations.AddField(
            model_name='counteritem',
            name='opacity',
            field=models.FloatField(default=1.0),
        ),
        migrations.AddField(
            model_name='embeditem',
            name='opacity',
            field=models.FloatField(default=1.0),
        ),
        migrations.AddField(
            model_name='imageitem',
            name='opacity',
            field=models.FloatField(default=1.0),
        ),
        migrations.AddField(
            model_name='stopwatchitem',
            name='opacity',
            field=models.FloatField(default=1.0),
        ),
        migrations.AddField(
            model_name='textitem',
            name='opacity',
            field=models.FloatField(default=1.0),
        ),
        migrations.AddField(
            model_name='twitchstreamembeditem',
            name='opacity',
            field=models.FloatField(default=1.0),
        ),
        migrations.AddField(
            model_name='youtubeembeditem',
            name='opacity',
            field=models.FloatField(default=1.0),
        ),
    ]
