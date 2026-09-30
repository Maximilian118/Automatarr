import { useContext, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import AppContext from "../../context"
import { AuthHandlers } from "../requests/graphqlRequest"

// The setUser/navigate pair that request helpers need to refresh tokens or log out
export const useAuthHandlers = (): AuthHandlers => {
  const { setUser } = useContext(AppContext)
  const navigate = useNavigate()
  return useMemo(() => ({ setUser, navigate }), [setUser, navigate])
}
