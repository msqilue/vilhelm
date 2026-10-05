# -*- coding: utf-8 -*-
"""Vilhelm 本地预览服务器
用法: python serve.py [端口]
特点: HTML/CSS/JS/JSON 带 Cache-Control: no-cache（修改后刷新即生效）；
媒体资源（图片/音频/视频）带 7 天长缓存，避免切换页面时大背景图重复加载导致黑屏。
"""
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

# 媒体资源：内容基本不变，给长缓存（图片/音频/视频）
MEDIA_EXT = (
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif',
    '.mp4', '.webm', '.ogg', '.mov',
    '.mp3', '.wav', '.m4a', '.aac', '.flac',
    '.ico', '.woff', '.woff2', '.ttf'
)


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        path = self.path.split('?')[0].lower()
        if path.endswith(MEDIA_EXT):
            self.send_header('Cache-Control', 'public, max-age=604800, immutable')
        else:
            # no-cache: 允许缓存，但每次使用前必须向服务器验证（Last-Modified）
            # 文件未变时返回 304，文件变化时立即返回新内容
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('', PORT), NoCacheHandler) as httpd:
        print('Vilhelm server: http://localhost:%d (html/js/css no-cache, media cached)' % PORT)
        httpd.serve_forever()
