import React, { FormEvent, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import MUITextField from "../components/utility/MUITextField/MUITextField"
import { initUserErrors } from "../shared/init"
import { UserErrorType } from "../types/userType"
import { LogIn } from "lucide-react"
import { updateInput } from "../shared/formValidation"
import { Link, useNavigate } from "react-router-dom"
import { login } from "../shared/requests/userRequests"
import { hasAccount } from "../shared/requests/authRequests"
import AuthLayout from "../components/auth/AuthLayout/AuthLayout"
import Button from "../components/ui/Button/Button"

const Login: React.FC = () => {
  const { user, setUser } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<UserErrorType>(initUserErrors())
  const [ accountExists, setAccountExists ] = useState<boolean>(true)

  const navigate = useNavigate()

  // Only offer "Create account" before the admin account exists
  useEffect(() => {
    hasAccount().then(setAccountExists)
  }, [])

  // Log in with the entered name and password
  const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    await login(user, setUser, setFormErr, setLocalLoading, navigate)
  }

  return (
    <AuthLayout
      title="Log in"
      onSubmit={e => onSubmitHandler(e)}
      actions={
        <Button type="submit" loading={localLoading} icon={<LogIn aria-hidden="true"/>}>Log in</Button>
      }
      links={
        <>
          {!accountExists && <Link to="/create">Create the admin account</Link>}
          <Link to="/forgot">Forgot your password?</Link>
        </>
      }
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
    </AuthLayout>
  )
}

export default Login
