import axios from "axios"
import { populateData } from "./requestPopulation"
import { Dispatch, SetStateAction } from "react"
import { dataType } from "../../types/dataType"

export const getData = async (
  setData: Dispatch<SetStateAction<dataType>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
): Promise<void> => {
  setLoading(true)

  try {
    const res = await axios.post("", {
      query: `
        query {
          getData {
            ${populateData}
          }
        }
      `,
    })

    if (res.data.errors) {
      console.error(`getData Error: ${res.data.errors[0].message}`)
    } else {
      setData(res.data.data.getData)
      console.log(`getData: Data retrieved.`)
    }
  } catch (err) {
    console.error(`getData Error: ${err}`)
  } finally {
    setLoading(false)
  }
}
