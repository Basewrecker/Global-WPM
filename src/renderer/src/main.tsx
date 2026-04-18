import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Settings from './Settings'
import Stats from './Stats'
import './index.css'

function Router() {
  const hash = window.location.hash

  if (hash === '#/settings') {
    return <Settings />
  }

  if (hash === '#/stats') {
    return <Stats />
  }

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
)
