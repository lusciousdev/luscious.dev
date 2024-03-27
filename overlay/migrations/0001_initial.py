# Generated by Django 4.2.9 on 2024-02-11 19:04

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CollaborativeOverlay',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(default='My Overlay', max_length=256)),
                ('description', models.CharField(max_length=256)),
                ('width', models.IntegerField(default=1920)),
                ('height', models.IntegerField(default=1080)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='TextItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(default='My Image', max_length=256)),
                ('x', models.IntegerField(default=-100)),
                ('y', models.IntegerField(default=-100)),
                ('width', models.IntegerField(default=50)),
                ('height', models.IntegerField(default=50)),
                ('rotation', models.FloatField(default=0)),
                ('visible', models.BooleanField(default=True)),
                ('text', models.TextField(default='Example text.')),
                ('color', models.CharField(default='#000000', max_length=64)),
                ('outline', models.CharField(default='#FFFFFF', max_length=64)),
                ('outline_enabled', models.BooleanField(default=False)),
                ('overlay', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='overlay.collaborativeoverlay')),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='ImageItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(default='My Image', max_length=256)),
                ('x', models.IntegerField(default=-100)),
                ('y', models.IntegerField(default=-100)),
                ('width', models.IntegerField(default=50)),
                ('height', models.IntegerField(default=50)),
                ('rotation', models.FloatField(default=0)),
                ('visible', models.BooleanField(default=True)),
                ('url', models.CharField(max_length=256)),
                ('overlay', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='overlay.collaborativeoverlay')),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='Editor',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('username', models.CharField(max_length=256)),
                ('twitch_id', models.CharField(max_length=256)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
