import { createContext, Dispatch, SetStateAction } from "react"

export interface AppContextType {
  loading: boolean
  setLoading: Dispatch<SetStateAction<boolean>>
}

const AppContext = createContext<AppContextType>({
  loading: false,
  setLoading: () => false,
})

export default AppContext
