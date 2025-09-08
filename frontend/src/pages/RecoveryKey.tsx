import React, { FormEvent, useContext, useEffect, useState } from "react"
import Footer from "../components/footer/footer"
import { Button, TextField } from "@mui/material"
import { Check, Key } from "@mui/icons-material"
import InputModel from "../components/model/inputModel/InputModel"
import AppContext from "../context"
import { useNavigate } from "react-router-dom"

const RecoveryKey: React.FC = () => {
  const { setLoading } = useContext(AppContext)
  const navigate = useNavigate()

  // Read immediately on mount
  const [recoveryKey] = useState(() => localStorage.getItem("recovery_key") ?? "")

  useEffect(() => {
    localStorage.removeItem("recovery_key")
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    navigate("/connections")
  }

  return (
    <>
      <form onSubmit={onSubmitHandler}>
        <InputModel title="Recovery Key" startIcon={<Key />}>
          <p>
            This is your recovery key. Store it somewhere safe. If you lose this key and forget your password, there will be no way to access your account.
          </p>
          <TextField
            value={recoveryKey}
            fullWidth
            slotProps={{ input: {readOnly: true } }}
          />
        </InputModel>
        <Button
          type="submit"
          color="success"
          variant="contained"
          sx={{ margin: "20px 0" }}
          endIcon={<Check color="inherit" />}
        >
          Done
        </Button>
      </form>
      <Footer />
    </>
  )
}


export default RecoveryKey
