import React from 'react'
import "./_footer.scss"
import { GitHub } from '@mui/icons-material'

const Footer: React.FC = () => (
  <footer>
    <h5>Maximilian Crosby</h5>
    <a href="https://github.com/Maximilian118/Automatarr" target="_blank" rel="noopener noreferrer">
      <GitHub/>
    </a>
  </footer>
)

export default Footer