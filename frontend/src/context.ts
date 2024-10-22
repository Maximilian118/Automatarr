import { createContext, Dispatch, SetStateAction } from "react"
import { settingsType } from "./shared/types"
import { initSettings } from "./shared/init"

export interface AppContextType {
  settings: settingsType
  setSettings: Dispatch<SetStateAction<settingsType>>
}

const AppContext = createContext<AppContextType>({
  settings: initSettings,
  setSettings: () => initSettings,
})

export default AppContext
