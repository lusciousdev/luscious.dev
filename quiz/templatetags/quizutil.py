from django.template import Library

register = Library()

@register.filter(name='bool2int')
def bool2int(field):
  return 1 if field else 0