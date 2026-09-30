import React from "react"
import { Link } from "react-router-dom"
import ReservoirTank from "../components/dashboard/ReservoirTank/ReservoirTank"
import "./_notFound.scss"

// Shown for any address that doesn't match a page
const NotFound: React.FC = () => (
  <main className="not-found">
    <div className="not-found-tank">
      <ReservoirTank used={0} label="An empty tank." />
    </div>
    <div className="not-found-text">
      <h1>Nothing here</h1>
      <p>This address doesn't match any page in Automatarr. It may have moved, or the link may be mistyped.</p>
      <Link to="/">Go to the start page</Link>
    </div>
  </main>
)

export default NotFound
