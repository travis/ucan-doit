import { useEffect, useState } from "react"
import { DID, Delegation } from "@ucanto/interface"
import { DB_NAME, listActors, openDatabase, createActor, listDelegations, clearAllDelegations, putDelegations, Actor } from "./database"
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

export function useActors (db?: IDBDatabase) {
  const swrResponse = useSWR(db && '/actors', async () => db && await listActors(db))
  return {
    get data () {
      return swrResponse.data
    },
    get actors () {
      return swrResponse.data as Actor[]
    },
    get error () {
      return swrResponse.error
    },
    get isLoading () {
      return swrResponse.isLoading
    },
    async create () {
      if (db) {
        await createActor(db)
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
    async putDelegations (delegations: Delegation[]) {
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
