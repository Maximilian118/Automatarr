import React, { SyntheticEvent, useEffect, useState } from 'react'
import "./_nav.scss"
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { useLocation, useNavigate } from 'react-router-dom'
import { navItems } from './navUtility'
import { CircularProgress } from '@mui/material'

const a11yProps = (index: number) => {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  }
}

type navTypes = {
  loading: boolean
}

const Nav: React.FC<navTypes> = ({ loading }) => {
  const [value, setValue] = useState(0)

  const handleChange = (e: SyntheticEvent, newValue: number) => {
    e.preventDefault()
    setValue(newValue)
  }

  const navigate = useNavigate()
  const location = useLocation()

  // Effect to set value based on the current location
  useEffect(() => {
    const currentTabIndex = navItems.findIndex(item => location.pathname === item.url)
    if (currentTabIndex !== -1 && currentTabIndex !== value) {
      setValue(currentTabIndex)
    }
  }, [location.pathname, value])

  return (
    <nav>
      <div className="nav-left">
        <img 
          alt="Automatarr" 
          src="https://automatarr.s3.eu-west-2.amazonaws.com/automatarr_logo_cropped.webp" 
          onClick={() => navigate("/")}
        />
        <Tabs value={value} onChange={handleChange}>
          {navItems.map((item, i) => 
            <Tab 
              key={i}
              label={item.text}
              onClick={() => navigate(item.url)}
              {...a11yProps(i)}
            />
          )}
        </Tabs>
      </div>
      {loading && <CircularProgress size={20} className="nav-spinner"/>}
    </nav>
  )
}

export default Nav