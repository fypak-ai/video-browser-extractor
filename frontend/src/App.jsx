import { useState, useCallback } from 'react'
import Browser from './components/Browser'
import VideoList from './components/VideoList'
import DropboxUploader from './components/DropboxUploader'
import Settings from './components/Settings'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  const [inputUrl, setInputUrl] = useState('')
  const [activeUrl, setActiveUrl] = useState('')
  const [videos, setVideos] = useState([])
  const [extracting, setExtracting] = useState(false)
  const [activeTab, setActiveTab] = useState('browser')
  const [dropboxToken, setDropboxToken] = useState(localStorage.getItem('dropbox_token') || '')
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const navigate = () => {
    if (!inputUrl.trim()) return
    const url = inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`
    setActiveUrl(url)
    setActiveTab('browser')
  }

  const handleExtract = async (urlOverride) => {
    const url = urlOverride || activeUrl
    if (!url) { showToast('Navegue para uma URL primeiro', 'warn'); return }
    setExtracting(true)
    try {
      const res = await fetch(`${API_BASE}/api/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      const data = await res.json()
      const newVids = data.videos || []
      setVideos(prev => {
        const existing = new Set(prev.map(v => v.url))
        return [...prev, ...newVids.filter(v => !existing.has(v.url))]
      })
      showToast(`${newVids.length} vídeo(s) encontrado(s)!`, 'success')
      if (newVids.length > 0) setActiveTab('videos')
    } catch (e) {
      showToast('Erro ao extrair: ' + e.message, 'error')
    } finally {
      setExtracting(false)
    }
  }

  const onBrowserVideoFound = useCallback((v) => {
    setVideos(prev => {
      if (prev.find(x => x.url === v.url)) return prev
      return [...prev, v]
    })
  }, [])

  const sendToDropbox = (video) => {
    setSelectedVideo(video)
    setActiveTab('dropbox')
  }

  const tabs = [
    { id: 'browser', label: '🌐 Navegador' },
    { id: 'videos', label: `🎥 Vídeos${videos.length > 0 ? ` (${videos.length})` : ''}` },
    { id: 'dropbox', label: '📦 Dropbox' },
    { id: 'settings', label: '⚙️ Config' },
  ]

  return (
    <div className="layout">
      {/* Header / URL bar */}
      <header className="header">
        <div className="logo">
          <span className="logo-icon">🎬</span>
          <span>VideoExtractor</span>
        </div>
        <div className="url-bar">
          <input
            type="text"
            className="url-input"
            placeholder="Digite uma URL (ex: youtube.com/watch?v=...)"
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && navigate()}
          />
          <button className="btn btn-ghost" onClick={navigate}>▶ Navegar</button>
          <button
            className="btn btn-primary"
            onClick={() => handleExtract()}
            disabled={extracting || !activeUrl}
          >
            {extracting ? <><span className="spinner" /> Extraindo...</> : '🔍 Extrair Vídeos'}
          </button>
          {videos.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={() => setVideos([])}>
              🗑 Limpar
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs-bar">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        {activeUrl && (
          <div className="current-url">
            <span className="dot green" />
            <span className="url-text">{activeUrl}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <main className="main-content">
        {activeTab === 'browser' && (
          <Browser
            url={activeUrl}
            apiBase={API_BASE}
            onVideoFound={onBrowserVideoFound}
            onNavigate={(url) => { setInputUrl(url); setActiveUrl(url) }}
          />
        )}
        {activeTab === 'videos' && (
          <VideoList
            videos={videos}
            onSendToDropbox={sendToDropbox}
            dropboxToken={dropboxToken}
            apiBase={API_BASE}
            showToast={showToast}
          />
        )}
        {activeTab === 'dropbox' && (
          <DropboxUploader
            video={selectedVideo}
            token={dropboxToken}
            apiBase={API_BASE}
            showToast={showToast}
          />
        )}
        {activeTab === 'settings' && (
          <Settings
            dropboxToken={dropboxToken}
            setDropboxToken={(t) => { setDropboxToken(t); localStorage.setItem('dropbox_token', t) }}
          />
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' && '✅ '}
          {toast.type === 'error' && '❌ '}
          {toast.type === 'warn' && '⚠️ '}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
