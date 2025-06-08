import React, { CSSProperties, Dispatch, SetStateAction } from 'react';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import "./_iconMenu.scss"
import { navItems } from '../navUtility';
import { useNavigate } from 'react-router-dom';

interface IconMenuType {
  setNavOpen: Dispatch<SetStateAction<boolean>>
  style?: CSSProperties
}

const IconMenu: React.FC<IconMenuType> = ({ setNavOpen, style }) => {
  const navigate = useNavigate()

  return (
    <MenuList className="icon-menu" style={style}>
      {navItems.map((item, i) =>
        <MenuItem key={i} onClick={() => {
          setNavOpen(false)
          navigate(item.url)
        }}>
          {item.text}
        </MenuItem>
      )}
    </MenuList>
  );
}

export default IconMenu