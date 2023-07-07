'use client'

import { useEffect, useState } from 'react'

import { Receipt, Signer } from '@ucanto/interface'
import { ConnectionView, connect } from '@ucanto/client'
import { Absentee } from '@ucanto/principal'
import { Signer as SignerImpl } from '@ucanto/principal/ed25519'
import * as HTTP from '@ucanto/transport/http'
import * as CAR from '@ucanto/transport/car'
import { invoke } from '@ucanto/core'
import * as DidMailto from '@web3-storage/did-mailto'
import { createSigner, listSigners } from '@/database'
import { useDatabase, useSigners } from '@/hooks'

function jsonify (a: any) {
  return a ? JSON.stringify(a, null, 4) : ''
}

export default function Home () {
  const url = new URL('https://pr194.up.web3.storage')
  const serverPrincipal = Absentee.from({ id: 'did:web:staging.web3.storage' })

  const [client, setClient] = useState<ConnectionView<any>>()
  useEffect(function () {
    async function createClient () {
      const c = connect({
        id: serverPrincipal,
        codec: CAR.outbound,
        channel: HTTP.open<any>({
          url,
          method: 'POST'
        })
      })
      setClient(c)
    }
    createClient()
  }, [])
  const db = useDatabase()
  const signers = useSigners(db)
  const agentPrincipal = signers?.[0]

  const [receipt, setReceipt] = useState<Receipt | undefined>()

  async function authorize () {
    if (client && agentPrincipal) {
      setReceipt(undefined)
      setReceipt(
        await invoke({
          issuer: agentPrincipal,
          audience: serverPrincipal,
          capability: {
            can: 'access/authorize',
            with: agentPrincipal.did(),
            nb: {
              iss: DidMailto.fromEmail('user@example.com'),
              att: [
                { can: 'space/*' },
                { can: 'store/*' },
                { can: 'provider/add' },
                { can: 'upload/*' },
              ]
            }
          }
        }).execute(client)
      )
    }
  }

  async function claim () {
    if (client && agentPrincipal) {
      setReceipt(undefined)
      setReceipt(
        await invoke({
          issuer: agentPrincipal,
          audience: serverPrincipal,
          capability: {
            can: 'access/claim',
            with: agentPrincipal.did()
          }
        }).execute(client)
      )
    }
  }

  async function createNewSigner () {
    if (db) {
      createSigner(db)
      // TODO need to figure out how best to update the UI here
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-start p-24">
      <h4> Agent: {agentPrincipal?.did()} </h4>
      <h4> Server: {serverPrincipal?.did()} </h4>
      <button onClick={() => createNewSigner()}>Create Signer</button>
      <button onClick={() => authorize()}>Authorize</button>
      <button onClick={() => claim()}>Claim</button>
      <div className='flex flex-row'>
        <pre>
          {jsonify(receipt)}
        </pre>
        <pre>
          {jsonify(receipt?.out)}
        </pre>
      </div>
    </main>
  )
}
