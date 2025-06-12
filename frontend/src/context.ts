import { createContext, Dispatch, SetStateAction } from "react"
import { initData, initSettings, initUser } from "./shared/init"
import { settingsType } from "./types/settingsType"
import { dataType } from "./types/dataType"
import { UserType } from "./types/userType"

export interface AppContextType {
  user: UserType
  setUser: Dispatch<SetStateAction<UserType>>
  settings: settingsType
  setSettings: Dispatch<SetStateAction<settingsType>>
  loading: boolean
  setLoading: Dispatch<SetStateAction<boolean>>
  data: dataType
  setData: Dispatch<SetStateAction<dataType>>
}

const AppContext = createContext<AppContextType>({
  user: initUser,
  setUser: () => initUser,
  settings: initSettings,
  setSettings: () => initSettings,
  loading: false,
  setLoading: () => false,
  data: initData,
  setData: () => initData,
})

export default AppContext
