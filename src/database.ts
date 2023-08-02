'use client'

import { Delegation as DelegationImpl } from '@ucanto/core'
import * as Ucanto from '@ucanto/interface'
import { Signer as EDSigner } from '@ucanto/principal/ed25519'

export const DB_NAME = 'ucan-doit'
const ACTOR_TABLE = 'actors'
const DELEGATION_TABLE = 'delegations'

export async function openDatabase (name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1)


    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      const actors = db.createObjectStore(ACTOR_TABLE, { keyPath: 'id' })

      // actors deserve a name
      actors.createIndex('name', 'name', { unique: false })

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

interface ActorRecord extends Ucanto.SignerArchive {
  name: string
}

export interface Actor extends Ucanto.Signer {
  name: string
}

function signerAndNameToRecord (signer: Ucanto.Signer, name: string) {
  const signerArchive = signer.toArchive()
  return { ...signerArchive, name }
}

export async function createActor (db: IDBDatabase): Promise<Actor> {
  return new Promise(async (resolve, reject) => {
    const signer = await EDSigner.generate()
    const name = signer.did()
    const t = db.transaction(ACTOR_TABLE, 'readwrite')
    const actors = t.objectStore(ACTOR_TABLE)
    const request = actors.add(signerAndNameToRecord(signer, name))
    request.onerror = event => {
      console.error(event)
      reject(event)
    }
    request.onsuccess = event => {
      resolve({ ...signer, name })
    }
  })
}

export async function setActorName (db: IDBDatabase, actor: Actor, newName: string) {
  return new Promise(async (resolve, reject) => {

    const t = db.transaction(ACTOR_TABLE, 'readwrite')
    const actors = t.objectStore(ACTOR_TABLE)
    const request = actors.put(signerAndNameToRecord(actor, newName))
    request.onerror = event => {
      reject(event)
    }
    request.onsuccess = event => {
      actor.name = newName
      resolve(actor)
    }
  })
}

function actorRecordToActor (record: ActorRecord): Actor {
  const actor = EDSigner.from(record as Ucanto.SignerArchive<Ucanto.DID, EDSigner.SigAlg>) as unknown as Actor
  actor.name = record.name
  return actor
}

export async function listActors (db: IDBDatabase): Promise<Actor[]> {
  return new Promise(async (resolve, reject) => {
    const actorsStore = db.transaction(ACTOR_TABLE).objectStore(ACTOR_TABLE)
    const request = actorsStore.getAll()
    request.onerror = event => {
      console.error(event)
      reject(event)
    }
    request.onsuccess = event => {
      resolve((event.target as IDBRequest).result.map((s: unknown) => actorRecordToActor(s as ActorRecord)))
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