import React, { FormEvent, useContext, useEffect, useState } from "react"
import AppContext from "../context"
import MUITextField from "../components/utility/MUITextField/MUITextField"
import { initUserErrors } from "../shared/init"
import { UserErrorType } from "../types/userType"
import { ArrowLeft, UserPlus } from "lucide-react"
import { updateInput } from "../shared/formValidation"
import { createUser } from "../shared/requests/userRequests"
import { useNavigate } from "react-router-dom"
import AuthLayout from "../components/auth/AuthLayout/AuthLayout"
import Button from "../components/ui/Button/Button"

const Create: React.FC = () => {
  const { user, setUser, loading, setLoading } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ formErr, setFormErr ] = useState<UserErrorType>(initUserErrors())

  const navigate = useNavigate()

  // Create the admin account
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
    <AuthLayout
      title="Create the admin account"
      intro={<p>Automatarr has one admin. You'll be shown a recovery key next; keep it safe, it's the only way back in if you forget your password.</p>}
      onSubmit={e => onSubmitHandler(e)}
      actions={
        <>
          <Button variant="secondary" icon={<ArrowLeft aria-hidden="true"/>} onClick={() => navigate(-1)}>Back</Button>
          <Button type="submit" loading={localLoading} icon={<UserPlus aria-hidden="true"/>}>Create account</Button>
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
        onBlur={e => updateInput(e, setUser, setFormErr, false)}
        type="password"
        minLength={8}
      />
    </AuthLayout>
  )
}

export default Create
