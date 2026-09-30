import React from 'react'
import "./_footer.scss"
import { GitHub } from '@mui/icons-material'

// Credit and source link shown at the bottom of each page
const Footer: React.FC = () => (
  <footer className="site-footer">
    <p className="footer-credit">Automatarr by Maximilian Crosby</p>
    <a href="https://github.com/Maximilian118/Automatarr" target="_blank" rel="noopener noreferrer">
      <GitHub aria-hidden="true" />
      <span className="visually-hidden">Automatarr on GitHub (opens in a new tab)</span>
    </a>
  </footer>
)

export default Footer
