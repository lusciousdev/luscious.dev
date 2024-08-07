# Generated by Django 4.2.11 on 2024-07-08 17:28

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('overlay', '0018_alter_counteritem_crop_bottom_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='counteritem',
            old_name='visible',
            new_name='visibility',
        ),
        migrations.RenameField(
            model_name='embeditem',
            old_name='visible',
            new_name='visibility',
        ),
        migrations.RenameField(
            model_name='imageitem',
            old_name='visible',
            new_name='visibility',
        ),
        migrations.RenameField(
            model_name='stopwatchitem',
            old_name='visible',
            new_name='visibility',
        ),
        migrations.RenameField(
            model_name='textitem',
            old_name='visible',
            new_name='visibility',
        ),
        migrations.RenameField(
            model_name='twitchstreamembeditem',
            old_name='visible',
            new_name='visibility',
        ),
        migrations.RenameField(
            model_name='twitchvideoembeditem',
            old_name='visible',
            new_name='visibility',
        ),
        migrations.RenameField(
            model_name='youtubeembeditem',
            old_name='visible',
            new_name='visibility',
        ),
    ]
