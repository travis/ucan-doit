import { useEffect, useState } from "react"
import { Signer } from "@ucanto/interface"
import { DB_NAME, listSigners, openDatabase } from "./database"

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
  const [signers, setSigners] = useState<Signer[] | undefined>()
  useEffect(function () {
    async function load () {
      if (db) {
        setSigners(await listSigners(db))
      }
    }
    load()
  }, [db])
  return signers
}
