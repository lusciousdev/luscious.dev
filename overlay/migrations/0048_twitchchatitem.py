# Generated by Django 5.1.1 on 2025-05-30 04:54

import django.db.models.deletion
import lusciousdev.util.modelutil
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('overlay', '0047_chatmessage'),
    ]

    operations = [
        migrations.CreateModel(
            name='TwitchChatItem',
            fields=[
                ('id', models.CharField(default=lusciousdev.util.modelutil.id_gen, editable=False, max_length=16, primary_key=True, serialize=False)),
                ('name', models.CharField(default='My Item', max_length=256)),
                ('x', models.IntegerField(default=-300)),
                ('y', models.IntegerField(default=-100)),
                ('z', models.IntegerField(default=50)),
                ('width', models.IntegerField(default=300)),
                ('height', models.IntegerField(default=100)),
                ('rotation', models.FloatField(default=0)),
                ('background_enabled', models.BooleanField(default=False)),
                ('background_color', models.CharField(default='#000000', max_length=255)),
                ('opacity', models.FloatField(default=100.0)),
                ('visibility', models.IntegerField(default=1)),
                ('minimized', models.BooleanField(default=False)),
                ('view_lock', models.BooleanField(default=False)),
                ('position_lock', models.BooleanField(default=False)),
                ('scroll_direction', models.IntegerField(default=0)),
                ('scroll_duration', models.FloatField(default=5.0)),
                ('crop_top', models.FloatField(default=0, verbose_name='Crop % (top)')),
                ('crop_left', models.FloatField(default=0, verbose_name='Crop % (left)')),
                ('crop_bottom', models.FloatField(default=0, verbose_name='Crop % (bottom)')),
                ('crop_right', models.FloatField(default=0, verbose_name='Crop % (right)')),
                ('font', models.CharField(default='Roboto Mono', max_length=255)),
                ('font_size', models.IntegerField(default=32)),
                ('font_weight', models.CharField(default='normal', max_length=128)),
                ('color', models.CharField(default='#FFFFFF', max_length=255)),
                ('drop_shadow_enabled', models.BooleanField(default=False)),
                ('drop_shadow_offset_x', models.FloatField(default=0.0)),
                ('drop_shadow_offset_y', models.FloatField(default=0.0)),
                ('drop_shadow_blur_radius', models.FloatField(default=0.0)),
                ('drop_shadow_color', models.CharField(default='#000000', max_length=255)),
                ('text_outline_enabled', models.BooleanField(default=False)),
                ('text_outline_width', models.FloatField(default=0.0)),
                ('text_outline_color', models.CharField(default='#000000', max_length=255)),
                ('text_alignment', models.CharField(default='left', max_length=128)),
                ('overlay', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='overlay.collaborativeoverlay')),
            ],
            options={
                'abstract': False,
            },
        ),
    ]
