"""Локальный статический сервер с поддержкой кастомной 404-страницы.

Использование: python serve.py   →   http://localhost:999/
Обычный `python -m http.server` не умеет отдавать нашу 404.html.
"""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote, urlsplit, urlunsplit
import os

ROOT = os.path.dirname(os.path.abspath(__file__))

# Красивые адреса без расширения → реальные файлы.
ALIASES = {
    '/': '/index.html',
    '/index': '/index.html',
    '/privacy': '/privacy.html',
    '/404': '/404.html',
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        parts = urlsplit(self.path)
        path = parts.path.rstrip('/') or '/'
        if path in ALIASES:
            self.path = urlunsplit(('', '', ALIASES[path], parts.query, ''))
        elif not os.path.exists(self.translate_path(parts.path)) and '.' not in os.path.basename(path):
            self.path = '/404.html?from=' + quote(self.path, safe='')
        return super().do_GET()


if __name__ == '__main__':
    print('TV dev4rev preview: http://localhost:999/')
    ThreadingHTTPServer(('127.0.0.1', 999), Handler).serve_forever()
