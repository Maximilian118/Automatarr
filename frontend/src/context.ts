import { createContext, Dispatch, SetStateAction } from "react"
import { initData, initSettings } from "./shared/init"
import { settingsType } from "./types/settingsType"
import { dataType } from "./types/dataType"

export interface AppContextType {
  settings: settingsType
  setSettings: Dispatch<SetStateAction<settingsType>>
  data: dataType
  setData: Dispatch<SetStateAction<dataType>>
  unixUsers: string[]
  setUnixUsers: Dispatch<SetStateAction<string[]>>
  unixGroups: string[]
  setUnixGroups: Dispatch<SetStateAction<string[]>>
}

const AppContext = createContext<AppContextType>({
  settings: initSettings,
  setSettings: () => initSettings,
  data: initData,
  setData: () => initData,
  unixUsers: [],
  setUnixUsers: () => [],
  unixGroups: [],
  setUnixGroups: () => [],
})

export default AppContext
