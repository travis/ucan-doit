import { useEffect, useState } from "react"
import { DID, Signer } from "@ucanto/interface"
import { DB_NAME, listSigners, openDatabase, createSigner } from "./database"
import useSWR from 'swr'
import { Absentee } from "@ucanto/principal"

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

export function useServerEndpoints () {
  return {
    data: [
      'https://pr194.up.web3.storage',
      'https://w3access-staging.protocol-labs.workers.dev'
    ]
  }
}

export function useServerPrincipals () {
  return {
    data: [
      'did:web:staging.web3.storage',
      'did:web:web3.storage'
    ],

    dids: [
      'did:web:staging.web3.storage' as DID,
      'did:web:web3.storage' as DID
    ]
  }
}