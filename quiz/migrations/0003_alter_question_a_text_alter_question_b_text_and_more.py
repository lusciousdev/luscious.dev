# Generated by Django 5.2.1 on 2025-05-22 00:09

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quiz', '0002_rename_multichoicequestion_question_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='question',
            name='a_text',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AlterField(
            model_name='question',
            name='b_text',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AlterField(
            model_name='question',
            name='c_text',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AlterField(
            model_name='question',
            name='d_text',
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
