import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { loadConfig } from './lib/storage'
import { loadCustomSkillsFromConfig, loadCustomSkillsFromDir } from './lib/skills'
import { isTauri } from './lib/tauri'
import { electronSetWorkspace, isElectron } from './lib/electron'
import { initCompanion, subscribeCompanion } from './lib/companion'
import { setWorkspaceStore } from './lib/workspaceStore'

// Hydrate custom skills from settings + (Tauri) from disk before first render's chat starts.
const cfg = loadConfig()
loadCustomSkillsFromConfig(cfg.customSkills)
if (isTauri() && cfg.skillsDir) {
  loadCustomSkillsFromDir(cfg.skillsDir).catch(() => {
    /* ignored — surfaces via /skills page */
  })
}
// Web build only: if a previous companion session was saved, ping it and resume.
if (!isTauri() && !isElectron()) {
  initCompanion()
  subscribeCompanion((s) => {
    if (s.workspace) setWorkspaceStore(s.workspace)
  })
}
// Electron: restore saved workspace to main process
if (isElectron()) {
  const savedWs = localStorage.getItem('simple-ai:workspace')
  if (savedWs) {
    electronSetWorkspace(savedWs)
  }
}

// Electron uses HashRouter (file:// doesn't support pushState); web/Tauri use BrowserRouter
const Router = isElectron() ? HashRouter : BrowserRouter

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
)
