from django import forms
from django.forms import inlineformset_factory
from django.core.validators import validate_email
from django.utils.translation import gettext_lazy as _
from allauth.socialaccount.models import SocialAccount
from .models import *
import logging

logger = logging.getLogger("quiz")

def is_empty_form(form):
    """
    A form is considered empty if it passes its validation,
    but doesn't have any data.

    This is primarily used in formsets, when you want to
    validate if an individual form is empty (extra_form).
    """
    if form.is_valid() and not form.cleaned_data:
        return True
    else:
        # Either the form has errors (isn't valid) or
        # it doesn't have errors and contains data.
        return False


def is_form_persisted(form):
    """
    Does the form have a model instance attached and it's not being added?
    e.g. The form is about an existing Book whose data is being edited.
    """
    if form.instance and not form.instance._state.adding:
        return True
    else:
        # Either the form has no instance attached or
        # it has an instance that is being added.
        return False
    
class DeleteQuizForm(forms.Form):
  overlay_id = forms.IntegerField()
  
  def __init__(self, user, *args, **kwargs):
    self.user = user
    super().__init__(*args, **kwargs)
    
  def clean(self):
    self.cleaned_data = super(DeleteQuizForm, self).clean()
    
    data = self.cleaned_data
    
    try:
      self.user.quiz_set.get(pk = data['quiz_id'])
    except Quiz.DoesNotExist:
      raise forms.ValidationError({ "quiz_id": "There is no quiz matching that ID." })

class QuestionForm(forms.ModelForm):
  class Meta:
    model = Question
    exclude = ()
    
MultiQuestionFormset     = inlineformset_factory(QuestionGroup, Question, form = QuestionForm, extra = 1)

class BaseQuestionGroupFormset(forms.BaseInlineFormSet):
  def add_fields(self, form, index):
    super().add_fields(form, index)
    
    form.questions = MultiQuestionFormset(instance = form.instance, 
                                      data = form.data if form.is_bound else None, 
                                      prefix = f'multiquestion-{form.prefix}-{MultiQuestionFormset.get_default_prefix()}')
    
  def is_valid(self):
    result = super().is_valid()
    
    if self.is_bound:
      for form in self.forms:
        if hasattr(form, 'questions'):
          result = result and form.questions.is_valid()
          
    return result
  
  def clean(self):
    super().clean()
    
    for form in self.forms:
      if not hasattr(form, 'questions') or not hasattr(form, 'tf') or self._should_delete_form(form):
        continue
      
      if self._is_adding_nested_inlines_to_empty_form(form):
        form.add_error(field = None, error = _("You are trying to add questions to a QuestionGroup which does not exist yet."))
        
  def save(self, commit = True):
    result = super().save(commit = commit)
    
    for form in self.forms:
      if hasattr(form, 'questions'):
        if not self._should_delete_form(form):
          form.questions.save(commit = commit)
    return result
  
  def _is_adding_nested_inlines_to_empty_form(self, form):
    if not hasattr(form, 'questions'):
      return False
    
    if is_form_persisted(form):
      return False
    
    if not is_empty_form(form):
      return False
    
    non_deleted_multi = set(form.questions.forms).difference(set(form.questions.deleted_forms))
    
    return any(not is_empty_form(f) for f in non_deleted_multi)
  
QuizQuestionGroupFormset = inlineformset_factory(Quiz, QuestionGroup, formset = BaseQuestionGroupFormset, exclude = (  ), extra = 1)