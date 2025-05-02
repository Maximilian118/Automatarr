import React from "react"
import { Route, Routes } from "react-router-dom"
import NotFound from "./pages/NotFound"
import Stats from "./pages/Stats"
import Connections from "./pages/Connections"
import Loops from "./pages/Loops"


const Router: React.FC = () => (
  <Routes>
    <Route path="*" Component={NotFound}/>
    <Route path="/" Component={Stats}/>
    <Route path="/connections" Component={Connections}/>
    <Route path="/loops" Component={Loops}/>
  </Routes>
)

export default Router