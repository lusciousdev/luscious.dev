from django.template import Library

register = Library()

@register.filter(name='add_attr')
def add_attr(field, css):
  attrs = {}
  definition = css.split(',')
  
  for d in definition:
    if ':' not in d:
      attrs['class'] = d
    else:
      key, val = d.split(':')
      attrs[key] = val
  
  return field.as_widget(attrs=attrs)

@register.filter
def keyvalue(dictionary, key):
  return dictionary[key]

@register.filter
def model_edit_form_template(model_name):
  return f"overlay/forms/edit/{ model_name }.html"

@register.filter
def model_add_form_template(model_name):
  return f"overlay/forms/add/{ model_name }.html"

@register.filter
def button_type_to_name(button_type : str) -> str:
  return button_type.replace("_", " ").capitalize()