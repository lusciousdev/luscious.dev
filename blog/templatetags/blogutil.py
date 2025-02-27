from django.template import Library
import markdown

register = Library()

@register.filter(name='md2html')
def markdown_to_html(markdown_content):
  md = markdown.Markdown(extensions = ["fenced_code"])
  html_content = md.convert(markdown_content)
  return html_content