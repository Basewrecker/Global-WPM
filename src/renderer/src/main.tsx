import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Settings from './Settings'
import './index.css'

function Router() {
  const hash = window.location.hash
  
  if (hash === '#/settings') {
    return <Settings />
  }
  
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
)
