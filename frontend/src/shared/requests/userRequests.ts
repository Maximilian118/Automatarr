import axios from "axios"
import { populateUser } from "./requestPopulation"
import { UserErrorType, UserType } from "../../types/userType"
import { Dispatch, SetStateAction } from "react"
import { loginSuccess } from "../localStorage"
import { NavigateFunction } from "react-router-dom"
import { getAxiosErrorMessage } from "./requestUtility"

export const createUser = async (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  setFormErr: Dispatch<SetStateAction<UserErrorType>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
  navigate: NavigateFunction,
): Promise<void> => {
  setLoading(true)

  try {
    const res = await axios.post("", {
      variables: {
        name: user.name,
        password: user.password,
      },
      query: `
        mutation CreateUser($name: String!, $password: String!) {
          createUser(name: $name, password: $password) {
            ${populateUser}
            recovery_key
          }
        }
      `,
    })

    if (res.data.errors) {
      console.error(`createUser Error: ${res.data.errors[0].message}`)
    } else {
      localStorage.setItem("recovery_key", res.data.data.createUser.recovery_key)
      loginSuccess("createUser", res, setUser, true)
      navigate("/recoverykey")
    }
  } catch (err) {
    setFormErr((prevErrs) => {
      return {
        ...prevErrs,
        password: getAxiosErrorMessage(err),
      }
    })

    console.error(`createUser Error: ${err}`)
  } finally {
    setLoading(false)
  }
}

export const login = async (
  user: UserType,
  setUser: Dispatch<SetStateAction<UserType>>,
  setFormErr: Dispatch<SetStateAction<UserErrorType>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
  navigate: NavigateFunction,
): Promise<void> => {
  setLoading(true)

  try {
    const res = await axios.post("", {
      variables: {
        name: user.name,
        password: user.password,
      },
      query: `
        query Login($name: String!, $password: String!) {
          login(name: $name, password: $password) {
            ${populateUser}
          }
        }
      `,
    })

    if (res.data.errors) {
      console.error(`login Error: ${res.data.errors[0].message}`)
    } else {
      loginSuccess("login", res, setUser, true)
      navigate("/")
    }
  } catch (err) {
    setFormErr((prevErrs) => {
      return {
        ...prevErrs,
        password: getAxiosErrorMessage(err),
      }
    })

    console.error(`login Error: ${err}`)
  } finally {
    setLoading(false)
  }
}

export const forgot = async (
  recovery_key: string,
  setUser: Dispatch<SetStateAction<UserType>>,
  setFormErr: Dispatch<SetStateAction<{ recovery_key: string }>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
  navigate: NavigateFunction,
): Promise<void> => {
  setLoading(true)

  try {
    const res = await axios.post("", {
      variables: {
        recovery_key,
      },
      query: `
        query Forgot($recovery_key: String!) {
          forgot(recovery_key: $recovery_key) {
            ${populateUser}
          }
        }
      `,
    })

    if (res.data.errors) {
      console.error(`forgot Error: ${res.data.errors[0].message}`)
    } else {
      loginSuccess("forgot", res, setUser, true)
      navigate("/settings")
    }
  } catch (err) {
    setFormErr((prevFormErr) => {
      return {
        ...prevFormErr,
        recovery_key: getAxiosErrorMessage(err),
      }
    })

    console.error(`forgot Error: ${err}`)
  } finally {
    setLoading(false)
  }
}
