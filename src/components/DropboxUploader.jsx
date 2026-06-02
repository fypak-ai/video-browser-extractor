import { useState, useEffect } from 'react'
import './DropboxUploader.css'

export default function DropboxUploader({ video, token, apiBase, showToast }) {
  const [videoUrl, setVideoUrl] = useState('')
  const [filename, setFilename] = useState('')
  const [useYdl, setUseYdl] = useState(true)
  const [jobId, setJobId] = useState(null)
  const [jobStatus, setJobStatus] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (video) {
      setVideoUrl(video.url || '')
      setFilename(video.suggestedName || `video_${Date.now()}.${video.ext || 'mp4'}`)
    }
  }, [video])

  useEffect(() => {
    if (!jobId) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/api/dropbox/status/${jobId}`)
        const data = await res.json()
        setJobStatus(data)
        if (data.status === 'done' || data.status === 'error') {
          clearInterval(interval)
          setUploading(false)
          if (data.status === 'done') {
            showToast('Enviado para o Dropbox com sucesso!', 'success')
            setHistory(prev => [{ jobId, filename, url: videoUrl, status: 'done', time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)])
          } else {
            showToast(data.message, 'error')
          }
        }
      } catch (e) {
        console.error(e)
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [jobId])

  const handleUpload = async () => {
    if (!token) { showToast('Configure o token Dropbox em ⚙️ Config', 'warn'); return }
    if (!videoUrl) { showToast('Informe a URL do vídeo', 'warn'); return }
    if (!filename) { showToast('Informe o nome do arquivo', 'warn'); return }

    setUploading(true)
    setJobStatus(null)
    try {
      const res = await fetch(`${apiBase}/api/dropbox/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: videoUrl,
          filename,
          access_token: token,
          use_ydl: useYdl
        })
      })
      const data = await res.json()
      setJobId(data.job_id)
    } catch (e) {
      setUploading(false)
      showToast('Erro ao iniciar upload: ' + e.message, 'error')
    }
  }

  const statusColor = {
    pending: '#facc15',
    downloading: '#6c9fff',
    uploading: '#c084fc',
    done: '#00d4aa',
    error: '#ff4757'
  }

  const statusLabel = {
    pending: '⏳ Preparando...',
    downloading: '⬇ Baixando vídeo...',
    uploading: '⬆ Enviando para Dropbox...',
    done: '✅ Concluído!',
    error: '❌ Erro'
  }

  return (
    <div className="dropbox-panel">
      <div className="dropbox-form">
        <h2>📦 Enviar para Dropbox</h2>

        {!token && (
          <div className="warning-box">
            ⚠️ Token do Dropbox não configurado. Vá em <strong>⚙️ Config</strong> e insira seu Access Token.
          </div>
        )}

        <div className="form-group">
          <label>URL do Vídeo (HLS/M3U8 ou MP4)</label>
          <input
            type="text"
            value={videoUrl}
            onChange={e => setVideoUrl(e.target.value)}
            placeholder="https://... .m3u8 ou .mp4"
            style={{ width: '100%' }}
          />
        </div>

        <div className="form-group">
          <label>Nome do arquivo no Dropbox</label>
          <input
            type="text"
            value={filename}
            onChange={e => setFilename(e.target.value)}
            placeholder="meu-video.mp4"
            style={{ width: '100%' }}
          />
        </div>

        <div className="form-group">
          <label>Método de download</label>
          <div className="method-options">
            <label className={`method-option${useYdl ? ' selected' : ''}`}>
              <input
                type="radio"
                checked={useYdl}
                onChange={() => setUseYdl(true)}
              />
              <div>
                <strong>yt-dlp (recomendado)</strong>
                <p>Suporta HLS/M3U8, converte para MP4 com ffmpeg. Funciona com YouTube, Vimeo, etc.</p>
              </div>
            </label>
            <label className={`method-option${!useYdl ? ' selected' : ''}`}>
              <input
                type="radio"
                checked={!useYdl}
                onChange={() => setUseYdl(false)}
              />
              <div>
                <strong>Download direto (HTTP)</strong>
                <p>Para URLs diretas de arquivo MP4. Mais rápido, mas não suporta HLS.</p>
              </div>
            </label>
          </div>
        </div>

        <button
          className="btn btn-success"
          onClick={handleUpload}
          disabled={uploading || !token}
          style={{ width: '100%', padding: '12px', fontSize: '15px' }}
        >
          {uploading ? <><span className="spinner" /> Processando...</> : '📤 Enviar para Dropbox'}
        </button>

        {/* Status */}
        {jobStatus && (
          <div className="job-status" style={{ '--status-color': statusColor[jobStatus.status] || '#888' }}>
            <div className="job-status-header">
              <span className="job-status-label">{statusLabel[jobStatus.status] || jobStatus.status}</span>
              <span className="job-status-pct">{jobStatus.progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${jobStatus.progress}%` }} />
            </div>
            <p className="job-message">{jobStatus.message}</p>
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="upload-history">
          <h3>Histórico de uploads</h3>
          {history.map((h, i) => (
            <div key={i} className="history-item">
              <span className="history-status">✅</span>
              <span className="history-name">{h.filename}</span>
              <span className="history-time">{h.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
