import os
import mimetypes
from flask import Flask, send_from_directory, request
from flask_socketio import SocketIO, emit

# ★WASMを正しく認識させる設定
mimetypes.add_type('application/wasm', '.wasm')
mimetypes.add_type('application/javascript', '.js')

# サーバーの初期設定
app = Flask(__name__, static_folder='.') # 現在のフォルダを配信元にする
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# ★現在の接続人数
online_user_count = 0

# --- ここからページ配信の設定 ---

# 1. どのURLに来ても、静的ファイルがあればそれを返す
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve(path):
    # ファイルが存在すれば返す、なければindex.htmlを返す（SPA対応）
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# 2. ★超重要：WASMを動かすためのセキュリティ許可証を全員に渡す
@app.after_request
def add_header(response):
    response.headers['Cross-Origin-Embedder-Policy'] = 'require-corp'
    response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
    return response

# --- ここからSocket通信（人数カウント）の設定 ---

@socketio.on('connect')
def on_connect():
    global online_user_count
    online_user_count += 1
    print(f"誰かが接続しました。現在: {online_user_count}人")
    # 全員に人数を送信
    emit('update_user_count', {'count': online_user_count}, broadcast=True)

@socketio.on('disconnect')
def on_disconnect():
    global online_user_count
    if online_user_count > 0:
        online_user_count -= 1
    print(f"誰かが切断しました。現在: {online_user_count}人")
    # 全員に人数を送信
    emit('update_user_count', {'count': online_user_count}, broadcast=True)

# サーバー起動
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8000))
    # Flask-SocketIOを使って起動
    socketio.run(app, host='0.0.0.0', port=port)
