import { useState } from 'react'
import './VideoList.css'

export default function VideoList({ videos, onSendToDropbox, dropboxToken, apiBase, showToast }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [copying, setCopying] = useState(null)

  const filtered = videos.filter(v => {
    if (filter !== 'all' && v.type !== filter) return false
    if (search && !v.url.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const copyUrl = async (url, index) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopying(index)
      showToast('URL copiada!', 'success')
      setTimeout(() => setCopying(null), 1500)
    } catch {
      showToast('Erro ao copiar', 'error')
    }
  }

  const openUrl = (url) => window.open(url, '_blank')

  const getFileName = (v) => {
    try {
      const u = new URL(v.url)
      const parts = u.pathname.split('/')
      const last = parts[parts.length - 1] || 'video'
      if (last.includes('.')) return last
      return `${last}.${v.ext || (v.type === 'hls' ? 'm3u8' : 'mp4')}`
    } catch {
      return `video_${Date.now()}.${v.ext || 'mp4'}`
    }
  }

  const hlsCount = videos.filter(v => v.type === 'hls').length
  const mp4Count = videos.filter(v => v.type === 'mp4').length

  return (
    <div className="video-list-panel">
      {videos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎥</div>
          <h2>Nenhum vídeo extraído ainda</h2>
          <p>Navegue para um site com vídeo e clique em<br /><strong>🔍 Extrair Vídeos</strong> na barra acima</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="video-stats">
            <div className="stat-item">
              <span className="stat-num">{videos.length}</span>
              <span className="stat-label">Total</span>
            </div>
            <div className="stat-item">
              <span className="stat-num" style={{ color: '#00d4aa' }}>{hlsCount}</span>
              <span className="stat-label">HLS/M3U8</span>
            </div>
            <div className="stat-item">
              <span className="stat-num" style={{ color: '#6c9fff' }}>{mp4Count}</span>
              <span className="stat-label">MP4</span>
            </div>
            {!dropboxToken && (
              <div className="token-warning">
                ⚠️ Configure o token Dropbox em <strong>⚙️ Config</strong> para enviar vídeos
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="video-filters">
            <div className="filter-group">
              {['all', 'hls', 'mp4'].map(f => (
                <button
                  key={f}
                  className={`filter-btn${filter === f ? ' active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? `Todos (${videos.length})` : f === 'hls' ? `HLS (${hlsCount})` : `MP4 (${mp4Count})`}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Filtrar URLs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 200 }}
            />
          </div>

          {/* List */}
          <div className="video-items">
            {filtered.length === 0 ? (
              <div className="no-results">Nenhum resultado para o filtro aplicado</div>
            ) : (
              filtered.map((v, i) => (
                <div key={i} className="video-item">
                  <div className="video-item-header">
                    <span className={`badge badge-${v.type}`}>{v.type === 'hls' ? '▶ HLS/M3U8' : '▶ MP4'}</span>
                    {v.quality && v.quality !== 'unknown' && (
                      <span className="tag" style={{ background: '#1e2a1e', color: '#4ade80' }}>{v.quality}</span>
                    )}
                    {v.source && (
                      <span className={`badge badge-${v.source}`}>{v.source}</span>
                    )}
                    {v.title && (
                      <span className="video-title">{v.title}</span>
                    )}
                  </div>
                  <div className="video-url-row">
                    <span className="video-url">{v.url}</span>
                  </div>
                  <div className="video-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => copyUrl(v.url, i)}
                    >
                      {copying === i ? '✅ Copiado' : '📋 Copiar URL'}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => openUrl(v.url)}
                    >
                      🔗 Abrir
                    </button>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => onSendToDropbox({ ...v, suggestedName: getFileName(v) })}
                      disabled={!dropboxToken}
                      title={!dropboxToken ? 'Configure o token Dropbox em ⚙️ Config' : 'Enviar para Dropbox'}
                    >
                      📦 Enviar para Dropbox
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
