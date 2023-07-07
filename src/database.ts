'use client'

import { Signer } from '@ucanto/interface'
import { Signer as SignerImpl } from '@ucanto/principal/ed25519'


export const DB_NAME = 'doit_dev1'
const SIGNER_TABLE = 'signers'


export async function openDatabase (name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1)


    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      const users = db.createObjectStore(SIGNER_TABLE, { keyPath: 'id' });

      // actors deserve a name
      users.createIndex('name', 'name', { unique: false });
    }

    request.onerror = (event) => {
      console.error(event)
      reject(event)
    }

    request.onsuccess = event => {
      const db = (event.target as IDBOpenDBRequest).result
      resolve(db)

    }
  })
}

export async function createSigner (db: IDBDatabase): Promise<Signer> {
  return new Promise(async (resolve, reject) => {
    const signer = await SignerImpl.generate()
    const t = db.transaction(SIGNER_TABLE, 'readwrite')
    const signers = t.objectStore(SIGNER_TABLE)
    const signerArchive = signer.toArchive()
    const request = signers.add({
      ...signerArchive,
      name: signerArchive.id
    })
    request.onerror = event => {
      reject(event)
    }
    request.onsuccess = event => {
      resolve(signer)
    }
  })
}

export async function listSigners (db: IDBDatabase): Promise<Signer[]> {
  return new Promise(async (resolve, reject) => {

    const signers = db.transaction(SIGNER_TABLE).objectStore(SIGNER_TABLE)
    const request = signers.getAll()
    request.onerror = event => {
      reject(event)
    }
    request.onsuccess = event => {
      resolve((event.target as IDBRequest).result.map((s: any) => SignerImpl.from(s)))
    }
  })
}