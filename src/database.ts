'use client'

import { Delegation as DelegationImpl } from '@ucanto/core'
import * as Ucanto from '@ucanto/interface'
import { Signer as SignerImpl } from '@ucanto/principal/ed25519'


export const DB_NAME = 'ucan-doit'
const SIGNER_TABLE = 'signers'
const DELEGATION_TABLE = 'delegations'

export async function openDatabase (name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1)


    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      const signers = db.createObjectStore(SIGNER_TABLE, { keyPath: 'id' })

      // actors deserve a name
      signers.createIndex('name', 'name', { unique: false })

      const delegations = db.createObjectStore(DELEGATION_TABLE, { keyPath: 'cid' })
      delegations.createIndex('ability', 'ability', { multiEntry: true })
      delegations.createIndex('resource', 'resource', { multiEntry: true })
      delegations.createIndex('audience', 'audience');
      delegations.createIndex('issuer', 'issuer');
      delegations.createIndex('expiration', 'expiration');
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

export async function createSigner (db: IDBDatabase): Promise<Ucanto.Signer> {
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
      console.error(event)
      reject(event)
    }
    request.onsuccess = event => {
      resolve(signer)
    }
  })
}

export async function listSigners (db: IDBDatabase): Promise<Ucanto.Signer[]> {
  return new Promise(async (resolve, reject) => {
    const signersStore = db.transaction(SIGNER_TABLE).objectStore(SIGNER_TABLE)
    const request = signersStore.getAll()
    request.onerror = event => {
      console.error(event)
      reject(event)
    }
    request.onsuccess = event => {
      resolve((event.target as IDBRequest).result.map((s: any) => SignerImpl.from(s)))
    }
  })
}

export async function listDelegations (db: IDBDatabase): Promise<Ucanto.Delegation[]> {
  return new Promise(async (resolve, reject) => {
    const delegationsStore = db.transaction(DELEGATION_TABLE).objectStore(DELEGATION_TABLE)
    const request = delegationsStore.getAll()
    request.onerror = event => {
      console.error(event)
      reject(event)
    }
    request.onsuccess = event => {
      resolve(Promise.all((event.target as IDBRequest).result.map(async (s: any) => {
        const result = await DelegationImpl.extract(s.archive)
        // TODO: we should handle errors here somehow
        return result.ok
      })))
    }
  })
}

export async function clearAllDelegations (db: IDBDatabase): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const delegationsStore = db.transaction(DELEGATION_TABLE, 'readwrite').objectStore(DELEGATION_TABLE)
    const request = delegationsStore.clear()
    request.onerror = event => {
      console.error(event)
      reject(event)
    }
    request.onsuccess = () => {
      resolve()
    }
  })
}

export async function putDelegations (db: IDBDatabase, delegations: Ucanto.Delegation[]): Promise<void> {
  return new Promise(async (resolveAll, rejectAll) => {
    const storableDelegations = await Promise.all(delegations.map(async (delegation) => {
      const capabilities = delegation.capabilities
      return {
        cid: delegation.asCID.toString(),
        audience: delegation.audience.did(),
        issuer: delegation.issuer.did(),
        expiration: delegation.expiration,
        ability: Array.from(new Set(capabilities.map(c => c.can))),
        resource: Array.from(new Set(capabilities.map(c => c.with))),
        archive: (await delegation.archive()).ok
      }
    }))
    // this next bit MUST not have awaits in it because the transaction will close when 
    // control returns to the event loop
    const t = db.transaction(DELEGATION_TABLE, 'readwrite')
    const delegationsStore = t.objectStore(DELEGATION_TABLE)
    for (const storableDelegation of storableDelegations) {
      delegationsStore.put(storableDelegation)
    }
    // end await ban since we have written to the transaction already
    t.onerror = event => {
      console.error(event)
      rejectAll(event)
    }
    t.oncomplete = event => {
      resolveAll()
    }
  })
}