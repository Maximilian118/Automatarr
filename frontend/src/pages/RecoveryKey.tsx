import React, { FormEvent, useContext, useEffect, useState } from "react"
import Footer from "../components/footer/Footer"
import { TextField } from "@mui/material"
import { Check, Copy, KeyRound } from "lucide-react"
import InputPanel from "../components/panel/inputPanel/InputPanel"
import AppContext from "../context"
import { useNavigate } from "react-router-dom"
import PageHeader from "../components/ui/PageHeader/PageHeader"
import Button from "../components/ui/Button/Button"
import { useToast } from "../shared/toast/useToast"

const RecoveryKey: React.FC = () => {
  const { setLoading } = useContext(AppContext)
  const navigate = useNavigate()
  const { showToast } = useToast()

  // Read immediately on mount
  const [recoveryKey] = useState(() => localStorage.getItem("recovery_key") ?? "")

  useEffect(() => {
    localStorage.removeItem("recovery_key")
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Continue to connecting the Starr apps
  const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    navigate("/connections")
  }

  // Put the key on the clipboard where the browser allows it
  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey)
      showToast({ tone: "success", title: "Recovery key copied" })
    } catch {
      showToast({ tone: "error", title: "Couldn't copy the key", message: "Select the key and copy it by hand." })
    }
  }

  return (
    <form onSubmit={onSubmitHandler}>
      <PageHeader title="Save your recovery key" description="This is shown once. You'll need it if you ever forget your password." />
      <InputPanel title="Recovery key" startIcon={<KeyRound aria-hidden="true"/>}>
        <p>
          Store it somewhere safe, like a password manager. If you lose this key and forget your password, there is no other way back into Automatarr.
        </p>
        <TextField
          value={recoveryKey}
          label="Recovery key"
          fullWidth
          slotProps={{ input: {readOnly: true } }}
        />
        <div className="button-bar">
          <Button variant="secondary" icon={<Copy aria-hidden="true"/>} onClick={copyKey}>Copy key</Button>
        </div>
      </InputPanel>
      <div className="page-bottom">
        <Button type="submit" icon={<Check aria-hidden="true"/>}>I've saved it, continue</Button>
        <Footer />
      </div>
    </form>
  )
}

export default RecoveryKey
