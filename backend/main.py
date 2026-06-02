from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
import asyncio
import yt_dlp
import httpx
import json
import os
import uuid
import re
import base64
from typing import Optional, List, Dict
from urllib.parse import urlparse, urljoin
import dropbox

app = FastAPI(title="Video Browser & Extractor", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store
jobs: Dict[str, dict] = {}


class BrowseRequest(BaseModel):
    url: str
    session_id: Optional[str] = None


class ExtractRequest(BaseModel):
    url: str


class DropboxUploadRequest(BaseModel):
    video_url: str
    filename: str
    access_token: str
    use_ydl: bool = True


# ─── Health ────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "message": "Video Browser & Extractor rodando"}


# ─── Browse (Playwright screenshot + network capture) ──────────────────────

@app.post("/api/browse")
async def browse(req: BrowseRequest):
    """Navega para uma URL com Playwright, retorna screenshot + URLs de vídeo interceptadas."""
    try:
        from playwright.async_api import async_playwright

        session_id = req.session_id or str(uuid.uuid4())
        found_videos: set = set()

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
            )
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 720},
            )

            # Intercept network requests via route
            async def intercept(route):
                url = route.request.url
                lower = url.lower()
                if any(
                    x in lower
                    for x in [
                        ".m3u8",
                        ".mp4",
                        "/hls/",
                        "/dash/",
                        "manifest",
                        "playlist",
                    ]
                ):
                    found_videos.add(url)
                await route.continue_()

            await context.route("**/*", intercept)

            page = await context.new_page()

            # Also listen to responses for content-type detection
            def on_response(response):
                url = response.url
                ct = response.headers.get("content-type", "")
                if "mpegurl" in ct or "x-mpegurl" in ct or ".m3u8" in url.lower():
                    found_videos.add(url)
                if ".mp4" in url.lower() and "video" in ct:
                    found_videos.add(url)

            page.on("response", on_response)

            try:
                await page.goto(req.url, wait_until="networkidle", timeout=30000)
            except Exception:
                try:
                    await page.goto(req.url, wait_until="domcontentloaded", timeout=15000)
                except Exception:
                    pass

            await asyncio.sleep(2)

            # DOM scraping for video sources
            try:
                video_srcs = await page.evaluate(
                    """
                    () => {
                        const srcs = new Set();
                        document.querySelectorAll('video, video source').forEach(el => {
                            if (el.src && el.src.startsWith('http')) srcs.add(el.src);
                            if (el.currentSrc && el.currentSrc.startsWith('http')) srcs.add(el.currentSrc);
                        });
                        // JWPlayer
                        try {
                            if (window.jwplayer) {
                                const p = window.jwplayer();
                                if (p && p.getPlaylist) {
                                    p.getPlaylist().forEach(item => {
                                        (item.sources || []).forEach(s => s.file && srcs.add(s.file));
                                    });
                                }
                            }
                        } catch(e) {}
                        // Video.js
                        try {
                            if (window.videojs) {
                                Object.values(window.videojs.players || {}).forEach(p => {
                                    try { const src = p.currentSrc(); if (src) srcs.add(src); } catch(e) {}
                                });
                            }
                        } catch(e) {}
                        return [...srcs];
                    }
                    """
                )
                for src in video_srcs:
                    found_videos.add(src)
            except Exception:
                pass

            # Regex on page HTML
            try:
                html = await page.content()
                for u in re.findall(r'https?://[^\s"\'<>\\]+\.m3u8[^\s"\'<>\\]*', html):
                    found_videos.add(u)
                for u in re.findall(r'https?://[^\s"\'<>\\]+\.mp4[^\s"\'<>\\]*', html):
                    found_videos.add(u)
            except Exception:
                pass

            screenshot_bytes = await page.screenshot(full_page=False)
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode()
            title = await page.title()
            current_url = page.url

            await browser.close()

        videos = []
        for url in found_videos:
            lower = url.lower()
            v_type = "hls" if ".m3u8" in lower else "mp4"
            videos.append({"url": url, "type": v_type, "ext": "m3u8" if v_type == "hls" else "mp4", "source": "playwright"})

        return {
            "session_id": session_id,
            "screenshot": screenshot_b64,
            "title": title,
            "current_url": current_url,
            "videos": videos,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Extract (yt-dlp + regex) ──────────────────────────────────────────────

@app.post("/api/extract")
async def extract_videos(req: ExtractRequest):
    """Extrai URLs de vídeo (HLS/M3U8/MP4) usando yt-dlp + regex."""
    results: List[dict] = []
    errors: List[str] = []

    # Method 1: yt-dlp
    try:
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "format": "bestvideo+bestaudio/best",
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(req.url, download=False)
            if info:
                formats = info.get("formats", [])
                if not formats and info.get("url"):
                    formats = [
                        {
                            "url": info["url"],
                            "ext": info.get("ext", "mp4"),
                            "height": info.get("height"),
                            "format_id": "best",
                            "protocol": info.get("protocol", ""),
                        }
                    ]
                seen = set()
                for fmt in formats:
                    url = fmt.get("url", "")
                    if not url or url in seen:
                        continue
                    seen.add(url)
                    proto = fmt.get("protocol", "") or ""
                    is_hls = ".m3u8" in url or "m3u8" in proto
                    results.append(
                        {
                            "url": url,
                            "type": "hls" if is_hls else "mp4",
                            "quality": (
                                f"{fmt['height']}p"
                                if fmt.get("height")
                                else fmt.get("format_id", "?")
                            ),
                            "ext": fmt.get("ext", "m3u8" if is_hls else "mp4"),
                            "source": "yt-dlp",
                            "title": info.get("title", ""),
                        }
                    )
    except Exception as e:
        errors.append(f"yt-dlp: {e}")

    # Method 2: Regex on raw HTML
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
            resp = await client.get(
                req.url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            )
            html = resp.text
            existing = {r["url"] for r in results}

            for u in set(re.findall(r'https?://[^\s"\'\\<>]+\.m3u8[^\s"\'\\<>]*', html)):
                if u not in existing:
                    results.append({"url": u, "type": "hls", "quality": "unknown", "ext": "m3u8", "source": "regex"})
                    existing.add(u)

            for u in set(re.findall(r'https?://[^\s"\'\\<>]+\.mp4[^\s"\'\\<>]*', html)):
                if u not in existing:
                    results.append({"url": u, "type": "mp4", "quality": "unknown", "ext": "mp4", "source": "regex"})
                    existing.add(u)
    except Exception as e:
        errors.append(f"regex: {e}")

    return {"videos": results, "count": len(results), "errors": errors}


# ─── Proxy (iframe) ────────────────────────────────────────────────────────

@app.get("/api/proxy")
async def proxy_page(url: str = Query(...)):
    """Proxy de página web removendo X-Frame-Options para permitir iframe."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            resp = await client.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            )
            content = resp.text
            parsed = urlparse(str(resp.url))
            base_url = f"{parsed.scheme}://{parsed.netloc}"

            # Inject base tag
            base_tag = f'<base href="{base_url}/">'
            if "<head>" in content:
                content = content.replace("<head>", f"<head>{base_tag}", 1)
            elif "<HEAD>" in content:
                content = content.replace("<HEAD>", f"<HEAD>{base_tag}", 1)
            else:
                content = base_tag + content

            return HTMLResponse(
                content=content,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "X-Frame-Options": "ALLOWALL",
                    "Content-Security-Policy": "",
                },
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Dropbox Upload ────────────────────────────────────────────────────────

@app.post("/api/dropbox/upload")
async def upload_to_dropbox(req: DropboxUploadRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "pending", "progress": 0, "message": "Preparando..."}
    background_tasks.add_task(do_dropbox_upload, job_id, req)
    return {"job_id": job_id}


async def do_dropbox_upload(job_id: str, req: DropboxUploadRequest):
    try:
        jobs[job_id] = {"status": "downloading", "progress": 10, "message": "Baixando vídeo..."}

        dbx = dropbox.Dropbox(req.access_token)
        dropbox_path = f"/{req.filename}" if not req.filename.startswith("/") else req.filename

        if req.use_ydl:
            import tempfile, shutil

            tmp_dir = tempfile.mkdtemp()
            out_template = os.path.join(tmp_dir, "%(title)s.%(ext)s")

            ydl_opts = {
                "outtmpl": out_template,
                "quiet": True,
                "format": "best",
                "merge_output_format": "mp4",
            }
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: _ydl_download(ydl_opts, req.video_url),
            )

            files = [f for f in os.listdir(tmp_dir) if os.path.isfile(os.path.join(tmp_dir, f))]
            if not files:
                jobs[job_id] = {"status": "error", "progress": 0, "message": "❌ Arquivo não encontrado após download"}
                return

            actual_file = os.path.join(tmp_dir, files[0])
            filename = files[0]
            dropbox_path = f"/{filename}"

            jobs[job_id] = {"status": "uploading", "progress": 60, "message": "Enviando para Dropbox..."}

            file_size = os.path.getsize(actual_file)
            CHUNK = 150 * 1024 * 1024  # 150 MB

            with open(actual_file, "rb") as f:
                if file_size <= CHUNK:
                    dbx.files_upload(f.read(), dropbox_path, mode=dropbox.files.WriteMode.overwrite)
                else:
                    chunk = f.read(CHUNK)
                    session = dbx.files_upload_session_start(chunk)
                    cursor = dropbox.files.UploadSessionCursor(session_id=session.session_id, offset=len(chunk))
                    while True:
                        chunk = f.read(CHUNK)
                        if not chunk:
                            break
                        cursor.offset += len(chunk)
                        dbx.files_upload_session_append_v2(chunk, cursor)
                    commit = dropbox.files.CommitInfo(path=dropbox_path, mode=dropbox.files.WriteMode.overwrite)
                    dbx.files_upload_session_finish(b"", cursor, commit)

            shutil.rmtree(tmp_dir, ignore_errors=True)

        else:
            # Direct HTTP download
            async with httpx.AsyncClient(timeout=600, follow_redirects=True) as client:
                response = await client.get(req.video_url, headers={"User-Agent": "Mozilla/5.0"})
                content = response.content

            jobs[job_id] = {"status": "uploading", "progress": 60, "message": "Enviando para Dropbox..."}

            CHUNK = 150 * 1024 * 1024
            if len(content) <= CHUNK:
                dbx.files_upload(content, dropbox_path, mode=dropbox.files.WriteMode.overwrite)
            else:
                session = dbx.files_upload_session_start(content[:CHUNK])
                cursor = dropbox.files.UploadSessionCursor(session_id=session.session_id, offset=CHUNK)
                commit = dropbox.files.CommitInfo(path=dropbox_path, mode=dropbox.files.WriteMode.overwrite)
                dbx.files_upload_session_finish(content[CHUNK:], cursor, commit)

        jobs[job_id] = {
            "status": "done",
            "progress": 100,
            "message": f"✅ Enviado com sucesso para Dropbox: {dropbox_path}",
            "dropbox_path": dropbox_path,
        }

    except Exception as e:
        jobs[job_id] = {"status": "error", "progress": 0, "message": f"❌ Erro: {str(e)}"}


def _ydl_download(opts, url):
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])


@app.get("/api/dropbox/status/{job_id}")
async def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    return jobs[job_id]
