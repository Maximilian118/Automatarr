import React from "react"
import { Route, Routes } from "react-router-dom"
import NotFound from "./pages/NotFound"
import Stats from "./pages/Stats"
import Connections from "./pages/Connections"
import Loops from "./pages/Loops"
import Bots from "./pages/Bots"
import Logs from "./pages/Logs"
import { UserType } from "./types/userType"
import Login from "./pages/Login"
import Forgot from "./pages/Forgot"
import Create from "./pages/Create"
import Settings from "./pages/Settings"
import RecoveryKey from "./pages/RecoveryKey"

interface routerType {
  user: UserType,
}

const Router: React.FC<routerType> = ({ user }) => user.token ? (
  <Routes>
    <Route path="*" Component={NotFound}/>
    <Route path="/" Component={Stats}/>
    <Route path="/connections" Component={Connections}/>
    <Route path="/loops" Component={Loops}/>
    <Route path="/bots" Component={Bots}/>
    <Route path="/logs" Component={Logs}/>
    <Route path="/settings" Component={Settings}/>
    <Route path="/recoverykey" Component={RecoveryKey}/>
  </Routes>
) : (
  <Routes>
    <Route path="*" Component={NotFound}/>
    <Route path="/" Component={Login}/>
    <Route path="/forgot" Component={Forgot}/>
    <Route path="/create" Component={Create}/>
  </Routes>
)

export default Router