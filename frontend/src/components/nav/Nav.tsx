import React, { SyntheticEvent, useEffect, useState } from 'react'
import "./_nav.scss"
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { useLocation, useNavigate } from 'react-router-dom'
import { navItems } from './navUtility'

const a11yProps = (index: number) => {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  }
}

const Nav: React.FC = () => {
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
    </nav>
  )
}

export default Nav