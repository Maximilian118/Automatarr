import React from "react"
import './_centeredLoading.scss'
import { CircularProgress } from "@mui/material"

const CenteredLoading: React.FC = () => {
  return (
    <div className="centered-loading">
      <CircularProgress/>
    </div>
  )
}

export default CenteredLoading
