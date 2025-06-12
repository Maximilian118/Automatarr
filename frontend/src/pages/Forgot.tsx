import React, { FormEvent, useContext, useEffect, useState } from "react"
import Footer from "../components/footer/Footer"
import InputModel from "../components/model/inputModel/InputModel"
import { Button, CircularProgress } from "@mui/material"
import { LockReset, Send } from "@mui/icons-material"
import { forgot } from "../shared/requests/userRequests"
import AppContext from "../context"
import { useNavigate } from "react-router-dom"
import MUITextField from "../components/utility/MUITextField/MUITextField"

const Forgot: React.FC = () => {
  const { setUser, loading, setLoading } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ recovery_key, set_recovery_key ] = useState<string>("")
  const [ formErr, setFormErr ] = useState<{recovery_key: string }>({recovery_key: ""})

  const navigate = useNavigate()

  // Update settings object in db on submit
  const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await forgot(recovery_key, setUser, setFormErr, setLocalLoading, navigate)
  }

  // On localLoading change, change global loading as well
  useEffect(() => {
    if (localLoading !== loading) {
      setLoading(!loading)
    }
  }, [localLoading, loading, setLoading])

  return (
    <>
      <form onSubmit={e => onSubmitHandler(e)} className="login-form">
        <img 
          alt="Automatarr Logo"
          src="https://automatarr.s3.eu-west-2.amazonaws.com/automatarr_logo_cropped_circle.webp" 
        />
        <InputModel 
          title="Forgot" 
          startIcon={<LockReset/>}
        >
          <MUITextField
            name="recovery_key"
            label="Recovery Key"
            value={recovery_key}
            formErr={formErr}
            onChange={(e) => set_recovery_key(e.target.value)}
          />
        </InputModel>
        <Button 
          type="submit"
          variant="contained"
          sx={{ margin: "20px 0" }}
          endIcon={localLoading ? 
            <CircularProgress size={20} color="inherit"/> : 
            <Send color="inherit"/>
          }
        >Submit</Button>
      </form>
      <Footer/>
    </>
  )
}

export default Forgot
