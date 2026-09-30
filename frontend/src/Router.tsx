import React, { lazy, Suspense } from "react"
import { Route, Routes } from "react-router-dom"
import { UserType } from "./types/userType"
import CenteredLoading from "./components/utility/CenteredLoading/CenteredLoading"
import Login from "./pages/Login"

// Pages load on first visit so the initial download stays small on phones
const NotFound = lazy(() => import("./pages/NotFound"))
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"))
const Activity = lazy(() => import("./pages/Activity/Activity"))
const Connections = lazy(() => import("./pages/Connections"))
const Loops = lazy(() => import("./pages/Loops"))
const Bots = lazy(() => import("./pages/Bots"))
const Lists = lazy(() => import("./pages/Lists/Lists"))
const Logs = lazy(() => import("./pages/Logs/Logs"))
const Users = lazy(() => import("./pages/Users"))
const Forgot = lazy(() => import("./pages/Forgot"))
const Create = lazy(() => import("./pages/Create"))
const Settings = lazy(() => import("./pages/Settings"))
const RecoveryKey = lazy(() => import("./pages/RecoveryKey"))

interface routerType {
  user: UserType,
}

const Router: React.FC<routerType> = ({ user }) => (
  <Suspense fallback={<CenteredLoading label="Loading page" />}>
    {user.token ? (
      <Routes>
        <Route path="*" Component={NotFound}/>
        <Route path="/" Component={Dashboard}/>
        <Route path="/activity" Component={Activity}/>
        <Route path="/connections" Component={Connections}/>
        <Route path="/loops" Component={Loops}/>
        <Route path="/bots" Component={Bots}/>
        <Route path="/lists" Component={Lists}/>
        <Route path="/logs" Component={Logs}/>
        <Route path="/users" Component={Users}/>
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
    )}
  </Suspense>
)

export default Router
