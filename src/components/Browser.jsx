import { useState, useEffect, useRef } from 'react'
import './Browser.css'

export default function Browser({ url, apiBase, onVideoFound, onNavigate }) {
  const [loading, setLoading] = useState(false)
  const [screenshot, setScreenshot] = useState(null)
  const [pageTitle, setPageTitle] = useState('')
  const [pageUrl, setPageUrl] = useState('')
  const [foundVideos, setFoundVideos] = useState([])
  const [iframeUrl, setIframeUrl] = useState('')
  const [iframeMode, setIframeMode] = useState(false)
  const iframeRef = useRef(null)

  useEffect(() => {
    if (!url) return
    setFoundVideos([])
    setScreenshot(null)
    setPageTitle('')
    loadPage(url)
  }, [url])

  const loadPage = async (targetUrl) => {
    setLoading(true)
    setIframeMode(false)

    // Try iframe first (fast path)
    setIframeUrl(`${apiBase}/api/proxy?url=${encodeURIComponent(targetUrl)}`)
    setIframeMode(true)

    // Also run Playwright in background for video capture
    try {
      const res = await fetch(`${apiBase}/api/browse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()

      if (data.screenshot) setScreenshot(data.screenshot)
      if (data.title) setPageTitle(data.title)
      if (data.current_url) setPageUrl(data.current_url)

      if (data.videos?.length > 0) {
        setFoundVideos(data.videos)
        data.videos.forEach(v => onVideoFound(v))
      }
    } catch (e) {
      console.warn('Playwright browse error:', e.message)
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => setIframeMode(m => !m)

  return (
    <div className="browser-panel">
      {/* Info bar */}
      <div className="browser-bar">
        <div className="browser-info">
          {loading && (
            <div className="loading-indicator">
              <span className="spinner" />
              <span>Carregando e capturando vídeos...</span>
            </div>
          )}
          {!loading && pageTitle && (
            <span className="page-title-text">📄 {pageTitle}</span>
          )}
          {!loading && !pageTitle && !url && (
            <span className="hint-text">⬆ Digite uma URL e clique em Navegar</span>
          )}
        </div>
        <div className="browser-actions">
          {foundVideos.length > 0 && (
            <div className="found-badge">
              🎉 {foundVideos.length} vídeo(s) capturado(s)
            </div>
          )}
          {url && (
            <button className="btn btn-ghost btn-sm" onClick={switchMode}>
              {iframeMode ? '📸 Screenshot' : '🌐 Iframe'}
            </button>
          )}
        </div>
      </div>

      {/* View */}
      <div className="browser-view">
        {!url ? (
          <div className="browser-placeholder">
            <div className="placeholder-icon">🌐</div>
            <h2>Navegador Embutido</h2>
            <p>Digite uma URL na barra acima e clique em <strong>Navegar</strong></p>
            <p>O sistema vai carregar a página e capturar automaticamente<br />links de vídeo HLS/M3U8 e MP4</p>
            <div className="example-sites">
              <span>Exemplos:</span>
              {['youtube.com', 'vimeo.com', 'dailymotion.com'].map(site => (
                <button
                  key={site}
                  className="btn btn-ghost btn-sm"
                  onClick={() => onNavigate(`https://${site}`)}
                >
                  {site}
                </button>
              ))}
            </div>
          </div>
        ) : iframeMode && iframeUrl ? (
          <iframe
            ref={iframeRef}
            src={iframeUrl}
            title="Navegador embutido"
            className="embedded-iframe"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : screenshot ? (
          <div className="screenshot-container">
            <div className="screenshot-banner">
              📸 Visualização da página (modo screenshot — mais compatível com sites que bloqueiam iframe)
            </div>
            <img
              src={`data:image/png;base64,${screenshot}`}
              alt="Screenshot da página"
              className="screenshot-img"
            />
          </div>
        ) : (
          <div className="browser-loading">
            <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
            <p>Carregando página...</p>
          </div>
        )}
      </div>

      {/* Captured videos mini-panel */}
      {foundVideos.length > 0 && (
        <div className="captured-videos-bar">
          <strong>Vídeos capturados nesta página:</strong>
          <div className="captured-list">
            {foundVideos.map((v, i) => (
              <div key={i} className="captured-item">
                <span className={`badge badge-${v.type}`}>{v.type.toUpperCase()}</span>
                <span className="captured-url">{v.url.slice(0, 80)}...</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
