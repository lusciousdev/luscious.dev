# Generated by Django 5.2.1 on 2025-06-21 22:00

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('overlay', '0058_alter_countdownitem_timer_end'),
    ]

    operations = [
        migrations.AlterField(
            model_name='audioitem',
            name='background_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='canvasitem',
            name='background_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='countdownitem',
            name='background_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='countdownitem',
            name='color',
            field=models.CharField(default='#FFFFFFFF', max_length=255),
        ),
        migrations.AlterField(
            model_name='countdownitem',
            name='drop_shadow_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='countdownitem',
            name='text_outline_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='counteritem',
            name='background_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='counteritem',
            name='color',
            field=models.CharField(default='#FFFFFFFF', max_length=255),
        ),
        migrations.AlterField(
            model_name='counteritem',
            name='drop_shadow_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='counteritem',
            name='text_outline_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='embeditem',
            name='background_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='imageitem',
            name='background_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='stopwatchitem',
            name='background_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='stopwatchitem',
            name='color',
            field=models.CharField(default='#FFFFFFFF', max_length=255),
        ),
        migrations.AlterField(
            model_name='stopwatchitem',
            name='drop_shadow_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='stopwatchitem',
            name='text_outline_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='textitem',
            name='background_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='textitem',
            name='color',
            field=models.CharField(default='#FFFFFFFF', max_length=255),
        ),
        migrations.AlterField(
            model_name='textitem',
            name='drop_shadow_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='textitem',
            name='text_outline_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchchatitem',
            name='background_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchchatitem',
            name='color',
            field=models.CharField(default='#FFFFFFFF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchchatitem',
            name='drop_shadow_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchchatitem',
            name='text_outline_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchpollitem',
            name='background_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchpollitem',
            name='bar_color',
            field=models.CharField(default='#EB5E28FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchpollitem',
            name='color',
            field=models.CharField(default='#FFFFFFFF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchpollitem',
            name='drop_shadow_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchpollitem',
            name='text_outline_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchpollitem',
            name='title_color',
            field=models.CharField(default='#FFFFFFFF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchpredictionitem',
            name='background_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchpredictionitem',
            name='bar_color',
            field=models.CharField(default='#EB5E28FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchpredictionitem',
            name='color',
            field=models.CharField(default='#FFFFFFFF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchpredictionitem',
            name='drop_shadow_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchpredictionitem',
            name='text_outline_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchpredictionitem',
            name='title_color',
            field=models.CharField(default='#FFFFFFFF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchstreamembeditem',
            name='background_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='twitchvideoembeditem',
            name='background_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
        migrations.AlterField(
            model_name='youtubeembeditem',
            name='background_color',
            field=models.CharField(default='#000000FF', max_length=255),
        ),
    ]
