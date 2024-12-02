import React, { Dispatch, FocusEvent, SetStateAction } from 'react'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import { SxProps } from '@mui/material'
import './_muiAutocomplete.scss'

type MUIAutocompleteType = {
  label: string
  options: string[]
  value: string | null
  setValue: Dispatch<SetStateAction<string | null>>
  onBlur?: (value: FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>) => void,
  style?: SxProps
  size?: "small" | "medium"
  disabled?: boolean
  error?: boolean
}

const MUIAutocomplete: React.FC<MUIAutocompleteType> = ({ 
  label, 
  options, 
  value, 
  setValue, 
  onBlur, 
  style, 
  size, 
  disabled,
  error,
}) => {
  const [inputValue, setInputValue] = React.useState('')

  return (
    <Autocomplete
      value={value}
      onChange={(_, newValue: string | null) => {
        setValue(newValue)
      }}
      inputValue={inputValue}
      onInputChange={(_, newInputValue) => {
        setInputValue(newInputValue)
      }}
      options={options}
      sx={style}
      className="mui-autocomplete"
      disabled={disabled}
      renderInput={(params) => (
        <TextField 
          {...params}
          name={label.toLocaleLowerCase().replace(/\s+/g, '_')}
          label={label} 
          size={size} 
          onBlur={e => onBlur && onBlur(e)}
          error={error}
        />
      )}
    />
  )
}

export default MUIAutocomplete