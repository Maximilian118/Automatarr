import React, { FormEvent, useContext, useEffect, useState } from "react"
import { ArrowLeft, KeyRound } from "lucide-react"
import { forgot } from "../shared/requests/userRequests"
import AppContext from "../context"
import { useNavigate } from "react-router-dom"
import MUITextField from "../components/utility/MUITextField/MUITextField"
import AuthLayout from "../components/auth/AuthLayout/AuthLayout"
import Button from "../components/ui/Button/Button"

const Forgot: React.FC = () => {
  const { setUser, loading, setLoading } = useContext(AppContext)
  const [ localLoading, setLocalLoading ] = useState<boolean>(false)
  const [ recovery_key, set_recovery_key ] = useState<string>("")
  const [ formErr, setFormErr ] = useState<{recovery_key: string }>({recovery_key: ""})

  const navigate = useNavigate()

  // Sign in with the recovery key
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
    <AuthLayout
      title="Use your recovery key"
      intro={<p>Enter the recovery key you saved when the account was created. You'll be signed in and taken to Settings to choose a new password.</p>}
      onSubmit={e => onSubmitHandler(e)}
      actions={
        <>
          <Button variant="secondary" icon={<ArrowLeft aria-hidden="true"/>} onClick={() => navigate(-1)}>Back</Button>
          <Button type="submit" loading={localLoading} icon={<KeyRound aria-hidden="true"/>}>Sign in</Button>
        </>
      }
    >
      <MUITextField
        name="recovery_key"
        label="Recovery Key"
        value={recovery_key}
        formErr={formErr}
        onChange={(e) => set_recovery_key(e.target.value)}
      />
    </AuthLayout>
  )
}

export default Forgot
