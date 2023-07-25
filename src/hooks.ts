import { useEffect, useState } from "react"
import { DID, Signer, Delegation } from "@ucanto/interface"
import { DB_NAME, listSigners, openDatabase, createSigner, listDelegations, clearAllDelegations, putDelegations } from "./database"
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

export function useDelegations (db?: IDBDatabase) {
  const swrResponse = useSWR(db && '/delegations', async () => db && await listDelegations(db))
  return {
    get data () {
      return swrResponse.data
    },
    get delegations () {
      return swrResponse.data as Delegation[]
    },
    get error () {
      return swrResponse.error
    },
    get isLoading () {
      return swrResponse.isLoading
    },
    async clearAll () {
      if (db) {
        await clearAllDelegations(db)
        swrResponse.mutate()
      }
    },
    async putDelegations(delegations: Delegation[]) {
      if (db) {
        await putDelegations(db, delegations)
        swrResponse.mutate()
      }
    }
  }
}

const SERVER_ENDPOINTS = [
  'https://staging.up.web3.storage',
  'https://up.web3.storage'
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
