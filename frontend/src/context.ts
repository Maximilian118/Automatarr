import { createContext, Dispatch, SetStateAction } from "react"
import { initData, initSettings } from "./shared/init"
import { settingsType } from "./types/settingsType"
import { dataType } from "./types/dataType"

export interface AppContextType {
  settings: settingsType
  setSettings: Dispatch<SetStateAction<settingsType>>
  data: dataType
  setData: Dispatch<SetStateAction<dataType>>
}

const AppContext = createContext<AppContextType>({
  settings: initSettings,
  setSettings: () => initSettings,
  data: initData,
  setData: () => initData,
})

export default AppContext
