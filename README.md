# 🎬 VideoExtractor — Navegador + HLS/M3U8 + Dropbox

Site funcional com **navegador embutido**, **extrator de HLS/M3U8 e MP4** e **upload para Dropbox**.

## Funcionalidades

- 🌐 **Navegador embutido** — Proxy de páginas + screenshot via Playwright
- 🔍 **Extrator HLS/M3U8** — yt-dlp (1000+ sites) + interceptação de rede + regex no HTML
- 🎥 **Extrator MP4** — Captura URLs diretas de arquivos MP4
- 📦 **Upload Dropbox** — Download via yt-dlp/ffmpeg, upload via API oficial do Dropbox
- 📊 **Histórico** — Rastreia uploads realizados na sessão

## Rodar localmente

### Pré-requisitos
- Python 3.11+, Node.js 20+, ffmpeg

### Backend
```bash
cd backend
pip install -r requirements.txt
playwright install chromium
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Acesse: http://localhost:3000

### Docker Compose (tudo de uma vez)
```bash
docker-compose up --build
```

## Deploy no Railway

**Backend:**
1. Crie serviço apontando para `/backend`
2. O `nixpacks.toml` configura Python + ffmpeg + Playwright automaticamente

**Frontend:**
1. Crie serviço apontando para `/frontend`
2. Variável: `VITE_API_URL=https://seu-backend.railway.app`

## Configurar Dropbox

1. Acesse [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps)
2. Crie app: **Scoped access → Full Dropbox**
3. Aba **Permissions**: marque `files.content.write`
4. Aba **Settings**: clique em **Generate access token**
5. Cole o token em **Config** no site

## API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/browse` | Navega com Playwright, retorna screenshot + vídeos |
| POST | `/api/extract` | Extrai vídeos via yt-dlp + regex |
| GET | `/api/proxy?url=...` | Proxy de página (remove X-Frame-Options) |
| POST | `/api/dropbox/upload` | Inicia upload para Dropbox (assíncrono) |
| GET | `/api/dropbox/status/{id}` | Status do job de upload |

## Stack

- **Backend**: Python 3.11, FastAPI, yt-dlp, Playwright, Dropbox SDK
- **Frontend**: React 18, Vite, CSS puro (dark theme)
- **Deploy**: Docker Compose / Railway (nixpacks)
