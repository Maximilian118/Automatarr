import React, { Dispatch, FocusEvent, Fragment, SetStateAction } from 'react'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import { CircularProgress, SxProps } from '@mui/material'
import './_muiAutocomplete.scss'

type MUIAutocompleteType = {
  label: string
  options: string[]
  value: string | null
  setValue: Dispatch<SetStateAction<string | null>>
  onBlur?: (value: FocusEvent<HTMLInputElement | HTMLTextAreaElement, Element>) => void,
  sx?: SxProps
  size?: "small" | "medium"
  disabled?: boolean
  error?: boolean
  name?: string
  startAdornment?: JSX.Element
  endAdornment?: JSX.Element
  optionsEndAdornment?: JSX.Element
  optionsEndAdornmentOnClick?: (option: string) => void
  noInteract?: boolean
  loading?: boolean
}

const MUIAutocomplete: React.FC<MUIAutocompleteType> = ({ 
  label, 
  options, 
  value, 
  setValue, 
  onBlur, 
  sx, 
  size, 
  disabled,
  error,
  name,
  startAdornment,
  endAdornment,
  optionsEndAdornment,
  optionsEndAdornmentOnClick,
  noInteract,
  loading,
}) => {
  const [inputValue, setInputValue] = React.useState("")
  const id = `${label}-autocomplete`

  return (
    <Autocomplete
      id={id}
      value={value}
      onChange={(_, newValue: string | null) => {
        setValue(newValue)
      }}
      inputValue={inputValue}
      onInputChange={(_, newInputValue) => {
        setInputValue(newInputValue)
      }}
      options={options}
      sx={sx}
      className={`mui-autocomplete${noInteract ? " mui-autocomplete-no-end-adornment" : ""}`}
      disabled={disabled}
      disableCloseOnSelect={!!optionsEndAdornment}
      renderOption={optionsEndAdornment ? (props, option, state: { index: number }) => (
        <li {...props} key={state.index} className="mui-autocomplete-option">
          <span>{option}</span>
          <div 
            onClick={() => {
              if (optionsEndAdornmentOnClick) {
                optionsEndAdornmentOnClick(option)
                document.getElementById(id)?.blur()
              }
            }}
          >
            {optionsEndAdornment}
          </div>
        </li>
      ) : undefined}
      renderInput={(params) => (
        <TextField 
          {...params}
          name={name ? name : label.toLocaleLowerCase().replace(/\s+/g, '_')}
          label={label} 
          size={size} 
          onBlur={e => onBlur && onBlur(e)}
          error={error}
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: startAdornment ? startAdornment : null,
              endAdornment: (
                <Fragment>
                  {loading ? <CircularProgress size={20} /> : null}
                  {endAdornment ? endAdornment : params.InputProps.endAdornment}
                </Fragment>
              ),
            }
          }} 
        />
      )}
    />
  )
}

export default MUIAutocomplete