import React, { SyntheticEvent, useState } from 'react'
import "./_nav.scss"
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'

const a11yProps = (index: number) => {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  }
}

const Nav: React.FC = () => {
  const [value, setValue] = useState(0)

  const handleChange = (e: SyntheticEvent, newValue: number) => {
    setValue(newValue)
  }

  return (
    <nav>
      <Tabs value={value} onChange={handleChange}>
        <Tab label="Stats" {...a11yProps(0)} />
        <Tab label="Settings" {...a11yProps(1)} />
      </Tabs>
    </nav>
  )
}

export default Nav