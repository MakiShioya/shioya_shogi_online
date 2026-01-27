import http.server
import socketserver
import mimetypes
import os

PORT = 8000

# ★ここが重要！.wasmを「プログラム」として認識させる
mimetypes.init()
mimetypes.add_type('application/wasm', '.wasm')
mimetypes.add_type('application/javascript', '.js')

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Wasmを動かすための「セキュリティ許可証」
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        super().end_headers()

    # 拡張子ごとの正しい名札付けを徹底させる
    def guess_type(self, path):
        base, ext = os.path.splitext(path)
        if ext in mimetypes.types_map:
            return mimetypes.types_map[ext]
        return super().guess_type(path)

print(f"Starting server at http://localhost:{PORT}")
print("Press Ctrl+C to stop")

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
    httpd.serve_forever()