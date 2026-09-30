import React from "react"
import './_centeredLoading.scss'
import { CircularProgress } from "@mui/material"

interface CenteredLoadingProps {
  label?: string
}

// A centred spinner with a spoken label for screen readers
const CenteredLoading: React.FC<CenteredLoadingProps> = ({ label = "Loading" }) => {
  return (
    <div className="centered-loading" role="status">
      <CircularProgress aria-hidden="true"/>
      <span className="visually-hidden">{label}</span>
    </div>
  )
}

export default CenteredLoading
