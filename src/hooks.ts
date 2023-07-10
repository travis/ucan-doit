import { useEffect, useState } from "react"
import { DID, Signer } from "@ucanto/interface"
import { DB_NAME, listSigners, openDatabase, createSigner } from "./database"
import useSWR from 'swr'

export function useDatabase (name = DB_NAME) {
  const [db, setDB] = useState<IDBDatabase | undefined>()
  useEffect(function () {
    async function load () {
      setDB(await openDatabase(name))
    }
    load()
  }, [name])
  return db
}

export function useSigners (db?: IDBDatabase) {
  const swrResponse = useSWR(db && '/signers', async () => db && await listSigners(db))
  return {
    get data () {
      return swrResponse.data
    },
    get signers () {
      return swrResponse.data as Signer[]
    },
    get error () {
      return swrResponse.error
    },
    get isLoading () {
      return swrResponse.isLoading
    },
    async create () {
      if (db) {
        await createSigner(db)
        swrResponse.mutate()
      }
    }
  }
}

const SERVER_ENDPOINTS = [
  'https://975ewytse8.execute-api.us-west-2.amazonaws.com',
  'https://pr194.up.web3.storage',
  'https://w3access-staging.protocol-labs.workers.dev'
]

export function useServerEndpoints () {
  return {
    data: SERVER_ENDPOINTS
  }
}

const SERVER_DIDS = [
  'did:web:staging.web3.storage',
  'did:web:web3.storage'
]

export function useServerPrincipals () {
  return {
    data: SERVER_DIDS,

    dids: SERVER_DIDS as DID[]
  }
}
