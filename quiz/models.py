import datetime
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.utils.timezone import now
from django.contrib.auth.models import User
import random

import logging

from lusciousdev.util.modelutil import *

def quiz_slug():
  return id_gen(6)

# Create your models here.
class Quiz(models.Model):
  owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete = models.CASCADE)
  
  slug = models.SlugField(default = quiz_slug, editable = False, null = False, blank = False)
  
  title = models.CharField(default = "New Quiz", max_length = 255, null = False, blank = False)
  
class QuestionGroup(models.Model):
  quiz = models.ForeignKey(Quiz, on_delete = models.CASCADE)
  
  ordering = models.IntegerField(default = 0)
  
  class Meta:
    ordering = ( "ordering", )
    
  def to_data_dict(self):
    qs = list(self.question_set.order_by('id').all())
    
    return {
      "ordering": self.ordering,
      "questions": [ q.to_data_dict() for q in qs ]
    }
  
class Question(models.Model):
  question_group = models.ForeignKey(QuestionGroup, on_delete = models.CASCADE)
  
  question = models.CharField(max_length = 255, blank = False)
  a_text    = models.CharField(max_length = 255, blank = True)
  a_correct = models.BooleanField(default = False)
  
  b_text    = models.CharField(max_length = 255, blank = True)
  b_correct = models.BooleanField(default = False)
  
  c_text    = models.CharField(max_length = 255, blank = True)
  c_correct = models.BooleanField(default = False)
  
  d_text    = models.CharField(max_length = 255, blank = True)
  d_correct = models.BooleanField(default = False)
  
  randomize_order = models.BooleanField(default = True)
  
  def get_options(self):
    options = [ (self.a_text, self.a_correct),
                (self.b_text, self.b_correct),
                (self.c_text, self.c_correct),
                (self.d_text, self.d_correct) ]
    
    options = list(filter(lambda tup: tup[0] != "", options))
    if self.randomize_order:
      random.shuffle(options)
      
    return options
  
  def to_data_dict(self):
    return {
      "question": self.question,
      "a_text": self.a_text,
      "a_correct": self.a_correct,
      "b_text": self.b_text,
      "b_correct": self.b_correct,
      "c_text": self.c_text,
      "c_correct": self.c_correct,
      "d_text": self.d_text,
      "d_correct": self.d_correct,
      "randomize_order": self.randomize_order,
    }