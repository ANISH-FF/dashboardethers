import os
import shutil
import zipfile
import threading
import queue
import time
from flask import Flask, render_template, request, jsonify, send_file, Response

from scraper import parse_item_list, scrape_item, slugify

app = Flask(__name__)
app.config['DOWNLOADS_FOLDER'] = os.path.join(os.path.abspath("."), "downloads")
os.makedirs(app.config['DOWNLOADS_FOLDER'], exist_ok=True)

# Global dictionary of queues to handle multiple clients/jobs
client_queues = {}

# Track session status: 'active' | 'done' per client_id
client_status = {}  # { client_id: { 'status': 'active'|'done', 'brand_slug': str } }

def log_to_queue(client_id, msg):
    if client_id in client_queues:
        client_queues[client_id].put(msg)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/parse_file', methods=['POST'])
def parse_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
        
    temp_path = os.path.join(app.config['DOWNLOADS_FOLDER'], 'temp_' + file.filename)
    file.save(temp_path)
    
    try:
        items = parse_item_list(temp_path)
        os.remove(temp_path)
        return jsonify({"items": items})
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": str(e)}), 500

@app.route('/api/session_status/<client_id>')
def session_status(client_id):
    """Check if a client has an active or completed session."""
    info = client_status.get(client_id)
    if not info:
        return jsonify({'status': 'none'})
    return jsonify(info)


@app.route('/api/scrape', methods=['POST'])
def start_scrape():
    data = request.json or {}
    items_text = data.get('items_text', '')
    platform = data.get('platform', 'zomato')
    count = int(data.get('count', 5))
    brand = data.get('brand', 'brand').strip() or "brand"
    client_id = data.get('client_id', 'default')
    
    # Initialize a fresh log queue for this client run
    client_queues[client_id] = queue.Queue()
    client_status[client_id] = {'status': 'active', 'brand_slug': None}
    
    items = []
    if items_text:
        items = [x.strip() for x in items_text.split('\n') if x.strip()]
        
    brand_slug = slugify(brand)
    # Per-user persistent directory (client_id = employee id, so same folder every time)
    session_dir_name = f"{client_id}_{brand_slug}"
    run_dir = os.path.join(app.config['DOWNLOADS_FOLDER'], session_dir_name)
    
    # Clear and recreate this client's folder for a fresh run
    if os.path.exists(run_dir):
        shutil.rmtree(run_dir, ignore_errors=True)
    os.makedirs(run_dir, exist_ok=True)
    
    # Save brand_slug to session status immediately
    client_status[client_id]['brand_slug'] = session_dir_name
    
    # Define background worker
    def worker():
        driver = None
        try:
            import scraper
            log_to_queue(client_id, f"Launching photo extraction engine [{platform.upper()}] for session '{session_dir_name}'...")
            
            # Fast HTTP Engine handles extraction directly without Chrome GUI browser
            driver = None

            for idx, item in enumerate(items):
                log_to_queue(client_id, f"\n[Item {idx+1}/{len(items)}]: {item}")
                try:
                    scraper.scrape_item(
                        item, 
                        run_dir, 
                        count, 
                        platform=platform, 
                        driver=driver, 
                        log_fn=lambda m: log_to_queue(client_id, m)
                    )
                except Exception as e:
                    log_to_queue(client_id, f"[!] Error on '{item}': {e}")
        except Exception as e:
            log_to_queue(client_id, f"Fatal engine error: {e}")
        finally:
            if driver:
                try:
                    driver.quit()
                except Exception:
                    pass
            log_to_queue(client_id, "__DONE__")
            client_status[client_id] = {'status': 'done', 'brand_slug': session_dir_name}

    threading.Thread(target=worker, daemon=True).start()
    
    return jsonify({
        "status": "started",
        "brand_slug": session_dir_name,
        "run_dir": run_dir
    })

@app.route('/api/stream_logs/<client_id>')
def stream_logs(client_id):
    def generate():
        q = client_queues.get(client_id)
        if not q:
            yield "data: __DONE__\n\n"
            return
            
        while True:
            try:
                msg = q.get(timeout=30)
                yield f"data: {msg}\n\n"
                if msg == "__DONE__":
                    break
            except Exception:
                yield "data: __DONE__\n\n"
                break
    return Response(generate(), mimetype="text/event-stream")

@app.route('/api/get_images', methods=['GET'])
def get_images():
    brand_slug = request.args.get('brand_slug')
    if not brand_slug:
        return jsonify({"images": []})

    run_dir = os.path.join(app.config['DOWNLOADS_FOLDER'], brand_slug)
    
    all_images = []
    if os.path.exists(run_dir):
        for root, _, files in os.walk(run_dir):
            for f in files:
                if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                    rel_path = os.path.relpath(os.path.join(root, f), run_dir)
                    rel_url = rel_path.replace('\\', '/')
                    all_images.append({
                        "original_name": f,
                        "rel_path": rel_path,
                        "url": f"/downloads/{brand_slug}/{rel_url}"
                    })
                
    return jsonify({"images": all_images})

@app.route('/downloads/<brand_slug>/<path:filename>')
def serve_image(brand_slug, filename):
    file_path = os.path.join(app.config['DOWNLOADS_FOLDER'], brand_slug, filename)
    if os.path.exists(file_path):
        return send_file(file_path)
    return jsonify({"error": "File not found"}), 404

@app.route('/api/zip', methods=['POST'])
def create_zip():
    data = request.json or {}
    brand_slug = data.get('brand_slug')
    images = data.get('images', [])
    
    run_dir = os.path.join(app.config['DOWNLOADS_FOLDER'], brand_slug)
    zip_dir = os.path.join(app.config['DOWNLOADS_FOLDER'], f"{brand_slug}_zip_temp")
    os.makedirs(zip_dir, exist_ok=True)
    
    for img in images:
        src = os.path.join(run_dir, img['rel_path'])
        folder_name = os.path.dirname(img['rel_path'])
        dst = os.path.join(zip_dir, folder_name, img['new'])
        
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if os.path.exists(src):
            shutil.copy2(src, dst)
            
    zip_path = os.path.join(app.config['DOWNLOADS_FOLDER'], f"{brand_slug}.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(zip_dir):
            for fname in files:
                fp = os.path.join(root, fname)
                arcname = os.path.relpath(fp, start=zip_dir)
                zf.write(fp, arcname=arcname)
                
    # cleanup temp dir
    shutil.rmtree(zip_dir, ignore_errors=True)
    
    return jsonify({"status": "success", "download_url": f"/api/download_zip/{brand_slug}.zip"})

@app.route('/api/download_zip/<filename>')
def download_zip(filename):
    zip_file = os.path.join(app.config['DOWNLOADS_FOLDER'], filename)
    if os.path.exists(zip_file):
        return send_file(zip_file, as_attachment=True)
    return jsonify({"error": "ZIP not found"}), 404

@app.route('/api/clear_session', methods=['POST'])
def clear_session():
    data = request.json or {}
    brand_slug = data.get('brand_slug')
    client_id = data.get('client_id')
    
    if client_id and client_id in client_status:
        client_status[client_id] = {'status': 'none', 'brand_slug': None}

    for cid, info in list(client_status.items()):
        if info.get('brand_slug') == brand_slug:
            client_status[cid] = {'status': 'none', 'brand_slug': None}

    session_dir = os.path.join(app.config['DOWNLOADS_FOLDER'], brand_slug) if brand_slug else None
    zip_file = os.path.join(app.config['DOWNLOADS_FOLDER'], f"{brand_slug}.zip") if brand_slug else None
    
    try:
        if session_dir and os.path.exists(session_dir):
            shutil.rmtree(session_dir, ignore_errors=True)
        if zip_file and os.path.exists(zip_file):
            os.remove(zip_file)
        return jsonify({"status": "success", "message": "Cleared session successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)
