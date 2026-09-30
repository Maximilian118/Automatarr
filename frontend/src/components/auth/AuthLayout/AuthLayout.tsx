import React, { FormEvent, ReactNode } from "react"
import logo from "../../../assets/logo.webp"
import Footer from "../../footer/Footer"
import "./_authLayout.scss"

interface AuthLayoutProps {
  title: string
  intro?: ReactNode
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  children: ReactNode
  actions: ReactNode
  links?: ReactNode
}

// Shared frame for the signed-out pages: brand on one side, a single focused form on the other
const AuthLayout: React.FC<AuthLayoutProps> = ({ title, intro, onSubmit, children, actions, links }) => (
  <main className="auth-page">
    <div className="auth-brand">
      <img src={logo} alt="" className="auth-logo" width={220} height={165} />
      <p className="auth-wordmark">automatarr</p>
      <p className="auth-tagline">Downloads flow in. Cleanups flow out. Your storage never overflows.</p>
    </div>
    <form className="auth-form" onSubmit={onSubmit}>
      <h1>{title}</h1>
      {intro && <div className="auth-intro">{intro}</div>}
      <div className="auth-fields">{children}</div>
      <div className="auth-actions">{actions}</div>
      {links && <div className="auth-links">{links}</div>}
    </form>
    <Footer />
  </main>
)

export default AuthLayout
