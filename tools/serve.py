#!/usr/bin/env python3
"""Dev server for StarSight: like `python3 -m http.server`, but every response says `Cache-Control: no-cache`.

Why: the plain server sends no caching rules, so browsers guess how long to keep each file. After an edit they can then
mix a fresh module with a stale one it imports (a new js/learn.js with an old js/course/text.js), the import fails and
the feature silently stops working. With no-cache the browser re-checks every file on each load (cheap 304s).

Usage (from the sky-atlas folder):  python3 tools/serve.py [port]   (default 5177)
"""
import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5177
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    handler = functools.partial(NoCacheHandler, directory=root)
    with http.server.ThreadingHTTPServer(('', port), handler) as httpd:
        print(f'StarSight dev server on http://localhost:{port}/ (no-cache), serving {root}')
        httpd.serve_forever()


if __name__ == '__main__':
    main()
