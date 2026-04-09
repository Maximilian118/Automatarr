import { Dispatch, SetStateAction } from "react"
import { UserType } from "../types/userType"
import { NavigateFunction } from "react-router-dom"

// Mutable references to React state setters, registered by App.tsx on mount.
// Used by the axios 401 interceptor to trigger logout from outside React.
let setUserRef: Dispatch<SetStateAction<UserType>> | null = null
let navigateRef: NavigateFunction | null = null

// Store references to setUser and navigate for use by the axios interceptor.
export const registerAuthCallbacks = (
  setUser: Dispatch<SetStateAction<UserType>>,
  navigate: NavigateFunction,
): void => {
  setUserRef = setUser
  navigateRef = navigate
}

// Retrieve the stored references for logout handling.
export const getAuthCallbacks = () => ({
  setUser: setUserRef,
  navigate: navigateRef,
})
