import './Settings.css'

export default function Settings({ dropboxToken, setDropboxToken }) {
  return (
    <div className="settings-panel">
      <div className="settings-card">
        <h2>⚙️ Configurações</h2>

        <section className="settings-section">
          <h3>📦 Dropbox</h3>
          <p className="section-desc">
            Para enviar vídeos ao Dropbox, você precisa de um Access Token.
            Crie um app em <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noreferrer">
              dropbox.com/developers/apps
            </a> com permissão <code>files.content.write</code>.
          </p>

          <div className="form-group">
            <label>Access Token</label>
            <input
              type="password"
              value={dropboxToken}
              onChange={e => setDropboxToken(e.target.value)}
              placeholder="sl.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              style={{ width: '100%', fontFamily: 'monospace' }}
            />
            {dropboxToken && (
              <div className="token-ok">✅ Token configurado ({dropboxToken.length} caracteres)</div>
            )}
          </div>

          <div className="steps">
            <h4>Como obter o token:</h4>
            <ol>
              <li>Acesse <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noreferrer">dropbox.com/developers/apps</a></li>
              <li>Clique em <strong>Create App</strong></li>
              <li>Escolha <strong>Scoped access → Full Dropbox</strong></li>
              <li>Dê um nome ao app e clique em <strong>Create App</strong></li>
              <li>Na aba <strong>Permissions</strong>, marque <code>files.content.write</code></li>
              <li>Na aba <strong>Settings</strong>, clique em <strong>Generate access token</strong></li>
              <li>Cole o token acima</li>
            </ol>
          </div>
        </section>

        <section className="settings-section">
          <h3>ℹ️ Sobre</h3>
          <div className="about-grid">
            <div className="about-item">
              <span>🌐</span>
              <div>
                <strong>Navegador embutido</strong>
                <p>Proxy de páginas web com detecção automática de vídeos via Playwright</p>
              </div>
            </div>
            <div className="about-item">
              <span>🔍</span>
              <div>
                <strong>Extrator HLS/M3U8 + MP4</strong>
                <p>yt-dlp (1000+ sites), interceptação de rede e regex no HTML</p>
              </div>
            </div>
            <div className="about-item">
              <span>📦</span>
              <div>
                <strong>Upload para Dropbox</strong>
                <p>Download do vídeo via yt-dlp ou HTTP direto, upload via API oficial</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
