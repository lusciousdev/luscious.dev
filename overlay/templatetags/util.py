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