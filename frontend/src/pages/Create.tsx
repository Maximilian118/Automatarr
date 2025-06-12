import React, { FormEvent, useContext, useEffect, useState } from "react"
import Footer from "../components/footer/Footer"
import AppContext from "../context"
import InputModel from "../components/model/inputModel/InputModel"
import MUITextField from "../components/utility/MUITextField/MUITextField"
import { initUserErrors } from "../shared/init"
import { UserErrorType } from "../types/userType"
import { Button, CircularProgress } from "@mui/material"
import { AccountCircle, Send } from "@mui/icons-material"
import { updateInput } from "../shared/formValidation"
import { createUser } from "../shared/requests/userRequests"
import { useNavigate } from "react-router-dom"

const Create: React.FC = () => {
  const { user, setUser, loading, setLoading } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<UserErrorType>(initUserErrors())

  const navigate = useNavigate()

  // Update settings object in db on submit
  const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    await createUser(user, setUser, setFormErr, setLocalLoading, navigate)
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
          title="Create Account" 
          startIcon={<AccountCircle/>}
        >
          <MUITextField 
            name={"name"} 
            value={user.name} 
            formErr={formErr}
            onChange={(e) => updateInput(e, setUser, setFormErr)}
          />
          <MUITextField 
            name={"password"} 
            value={user.password} 
            formErr={formErr}
            onChange={(e) => {
              setUser(prevUser => {
                return {
                  ...prevUser,
                  password: e.target.value || "",
                }
              })

              if (formErr.password) {
                setFormErr(prevErrs => {
                  return {
                    ...prevErrs,
                    password: "",
                  }
                })
              }
            }}
            onBlur={e => updateInput(e, setUser, setFormErr, false)}
            type="password"
            minLength={8}
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

export default Create
