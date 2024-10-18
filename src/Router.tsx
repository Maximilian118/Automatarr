import React from "react"
import { Route, Routes } from "react-router-dom"
import NotFound from "./pages/NotFound"
import Stats from "./pages/Stats"
import Settings from "./pages/Settings"


const Router: React.FC = () => (
  <Routes>
    <Route path="*" Component={NotFound}/>
    <Route path="/" Component={Stats}/>
    <Route path="/settings" Component={Settings}/>
  </Routes>
)

export default Router