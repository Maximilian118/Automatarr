import React, { FormEvent, useContext, useState } from "react"
import Footer from "../components/footer/footer"
import AppContext from "../context"
import InputModel from "../components/model/inputModel/InputModel"
import MUITextField from "../components/utility/MUITextField/MUITextField"
import { initUserErrors } from "../shared/init"
import { UserErrorType } from "../types/userType"
import { Button, CircularProgress } from "@mui/material"
import { LoginOutlined, Send } from "@mui/icons-material"
import { updateInput } from "../shared/formValidation"
import { useNavigate } from "react-router-dom"
import { login } from "../shared/requests/userRequests"

const Login: React.FC = () => {
  const { user, setUser } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<UserErrorType>(initUserErrors())

  const navigate = useNavigate()

  // Update settings object in db on submit
  const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    await login(user, setUser, setFormErr, setLocalLoading, navigate)
  }

  return (
    <>
      <form onSubmit={e => onSubmitHandler(e)} className="login-form">
        <img 
          alt="Automatarr Logo"
          src="https://automatarr.s3.eu-west-2.amazonaws.com/automatarr_logo_cropped_circle.webp" 
        />
        <InputModel 
          title="Login" 
          startIcon={<LoginOutlined/>}
          bottom={(
            <>
              <p className="create" onClick={() => navigate("/create")}>Create Account</p>
              <p className="forgot" onClick={() => navigate("/forgot")}>Forgot password?</p>
            </>
          )}
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
            type="password"
            error={!!formErr.password}
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

export default Login
