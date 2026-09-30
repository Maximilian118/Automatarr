import React, { ReactNode } from "react"
import "./_pageHeader.scss"

interface PageHeaderProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
}

// The heading block at the top of every page: one h1, a short plain-language description, optional actions
const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <header className="page-header">
    <div className="page-header-text">
      <h1>{title}</h1>
      {description && <p className="page-header-description">{description}</p>}
    </div>
    {actions && <div className="page-header-actions">{actions}</div>}
  </header>
)

export default PageHeader
