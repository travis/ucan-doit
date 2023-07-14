'use client'

import { useEffect, useState, useMemo } from 'react'
import { Combobox } from '@headlessui/react'

import { DID, Delegation, Receipt, Result } from '@ucanto/interface'
import { ConnectionView, connect } from '@ucanto/client'
import { Absentee } from '@ucanto/principal'
import * as HTTP from '@ucanto/transport/http'
import * as CAR from '@ucanto/transport/car'
import { invoke } from '@ucanto/core'
import * as DidMailto from '@web3-storage/did-mailto'
import { useDatabase, useServerEndpoints, useServerPrincipals, useSigners } from '@/hooks'
import { bytesToDelegations } from '@web3-storage/access/encoding'
import { ArrowPathIcon, CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'
import { Tab } from '@headlessui/react'

function jsonify (a: any) {
  return a ? JSON.stringify(a, null, 4) : ''
}

export default function Home () {

  const [loading, setLoading] = useState(false)

  const { data: endpointUrls } = useServerEndpoints()
  const [selectedEndpointQuery, setSelectedEndpointQuery] = useState('')
  const filteredEndpointUrls = endpointUrls?.filter(u => u.startsWith(selectedEndpointQuery))
  const [selectedEndpointUrl, setSelectedEndpointUrl] = useState<string>()
  useEffect(() => {
    if (!selectedEndpointUrl && endpointUrls && (endpointUrls.length > 0)) {
      setSelectedEndpointUrl(endpointUrls[0])
    }
  }, [endpointUrls])
  const url = useMemo(() => selectedEndpointUrl && new URL(selectedEndpointUrl), [selectedEndpointUrl])

  const { dids: serverPrincipalDids } = useServerPrincipals()
  const [selectedPrincipalQuery, setSelectedPrincipalQuery] = useState('')
  const filteredPrincipalDids = serverPrincipalDids?.filter(d => d.startsWith(selectedPrincipalQuery))
  const [selectedPrincipalDid, setSelectedPrincipalDid] = useState<string>()
  useEffect(() => {
    if (!selectedPrincipalDid && serverPrincipalDids && (serverPrincipalDids.length > 0)) {
      setSelectedPrincipalDid(serverPrincipalDids[0])
    }
  }, [serverPrincipalDids])
  const serverPrincipal = useMemo(() => selectedPrincipalDid && Absentee.from({ id: selectedPrincipalDid as DID }), [selectedPrincipalDid])

  const [client, setClient] = useState<ConnectionView<any>>()
  useEffect(function () {
    async function createClient () {
      if (serverPrincipal && url) {
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
    }
    createClient()
  }, [serverPrincipal, url])
  const db = useDatabase()

  const { signers, create: createSigner } = useSigners(db)
  const [selectedAgentQuery, setSelectedAgentQuery] = useState('')
  const filteredSigners = signers?.filter(s => s.did().startsWith(selectedAgentQuery))
  const [selectedAgentDid, setSelectedAgentDid] = useState('')
  // if selectedAgentDid is '', use the first signer we find, otherwise search for a matching DID
  const agentPrincipal = signers?.find(s => (selectedAgentDid === '') || (s.did() === selectedAgentDid))

  const [receipt, setRawReceipt] = useState<Receipt | undefined>()
  const [result, setResult] = useState<Result | undefined>()
  const [resultDelegations, setResultDelegations] = useState<Delegation[] | undefined>()

  async function setReceipt (receipt?: Receipt) {
    setRawReceipt(undefined)
    setResult(undefined)
    setResultDelegations(undefined)

    setRawReceipt(receipt)
    setResult(receipt?.out)

    // TODO: this is a janky way to detect delegations in the result, figure out something better
    const delegationCidsToBytes = (receipt?.out?.ok as any)?.delegations
    if (delegationCidsToBytes) {
      const delegationBytes = Object.values(delegationCidsToBytes) as Uint8Array[]
      const delegations = delegationBytes.flatMap(bytesToDelegations)
      setResultDelegations(delegations)
    }
  }

  const [authorizeEmail, setAuthorizeEmail] = useState<string | undefined>()
  async function authorize () {
    if (client && agentPrincipal && serverPrincipal && authorizeEmail) {
      setLoading(true)
      setReceipt(undefined)
      setReceipt(
        await invoke({
          issuer: agentPrincipal,
          audience: serverPrincipal,
          capability: {
            can: 'access/authorize',
            with: agentPrincipal.did(),
            nb: {
              iss: DidMailto.fromEmail(authorizeEmail as `{string}@{string}`),
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
      setLoading(false)

    }
  }

  async function claim () {
    if (client && agentPrincipal && serverPrincipal) {
      setLoading(true)
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
      setLoading(false)
    }
  }

  const [capabilityName, setCapabilityName] = useState<string>()
  const ability = (capabilityName == '' || capabilityName?.match('.*/.*')) ? capabilityName as Ability : null
  const [resourceName, setResourceName] = useState<string>()
  const resourceUri = (resourceName?.match('.*:.*')) ? resourceName as `${string}:${string}` : null
  async function execute () {
    if (client && agentPrincipal && serverPrincipal && ability && resourceUri) {
      setLoading(true)
      setReceipt(undefined)
      setReceipt(
        await invoke({
          issuer: agentPrincipal,
          audience: serverPrincipal,
          capability: {
            can: ability,
            with: resourceUri
          }
        }).execute(client)
      )
      setLoading(false)
    }
  }

  async function createNewSigner () {
    setLoading(true)
    await createSigner()
    setLoading(false)
  }

  const hasDelegationsTab = resultDelegations && resultDelegations.length > 0
  return (
    <main className="flex min-h-screen flex-col items-start p-24 w-screen">
      <div className='flex flex-row space-x-1'>
        <h4>
          Agent:
        </h4>
        {agentPrincipal && (
          <Combobox value={agentPrincipal.did()} onChange={setSelectedAgentDid} as='div' className='relative mt-1 w-[32rem] z-10'>
            <div className="relative w-full cursor-default overflow-hidden bg-white text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 sm:text-sm">
              <Combobox.Input
                onChange={(event) => setSelectedAgentQuery(event.target.value)}
                autoComplete='off'
                className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
              />
              <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon
                  className="h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
              </Combobox.Button>
            </div>
            <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {filteredSigners?.map(signer => (
                <Combobox.Option key={signer.did()} value={signer.did()}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-4 pr-4 ${active ? 'bg-teal-600 text-white' : 'text-gray-900'
                    }`
                  }>
                  <CheckIcon className="hidden ui-selected:block" />
                  {signer.did()}
                </Combobox.Option>
              ))}
            </Combobox.Options>
          </Combobox>
        )}
      </div>
      <div>
        <h4>Server:</h4>
        <div className='flex flex-row'>
          {selectedPrincipalDid && (
            <Combobox value={selectedPrincipalDid} onChange={setSelectedPrincipalDid} as='div' className='relative mt-1 w-72'>
              <div className="relative w-full cursor-default overflow-hidden bg-white text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 sm:text-sm">
                <Combobox.Input
                  onChange={(event) => setSelectedPrincipalQuery(event.target.value)}
                  autoComplete='off'
                  className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
                />
                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon
                    className="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </Combobox.Button>
              </div>
              <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                {filteredPrincipalDids?.map(did => (
                  <Combobox.Option key={did} value={did}
                    className={({ active }) =>
                      `relative cursor-default select-none py-2 pl-4 pr-4 ${active ? 'bg-teal-600 text-white' : 'text-gray-900'
                      }`
                    }>
                    <CheckIcon className="hidden ui-selected:block" />
                    {did}
                  </Combobox.Option>
                ))}
              </Combobox.Options>
            </Combobox>
          )}
          @
          {selectedEndpointUrl && (
            <Combobox value={selectedEndpointUrl} onChange={setSelectedEndpointUrl} as='div' className='relative mt-1 w-72'>
              <div className="relative w-full cursor-default overflow-hidden bg-white text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 sm:text-sm">
                <Combobox.Input
                  onChange={(event) => setSelectedEndpointQuery(event.target.value)}
                  autoComplete='off'
                  className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
                />
                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon
                    className="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </Combobox.Button>
              </div>
              <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                <Combobox.Option key={selectedEndpointQuery} value={selectedEndpointQuery}>{selectedEndpointQuery}</Combobox.Option>
                {filteredEndpointUrls?.map(url => (
                  <Combobox.Option key={url} value={url}
                    className={({ active }) =>
                      `relative cursor-default select-none py-2 pl-4 pr-4 ${active ? 'bg-teal-600 text-white' : 'text-gray-900'
                      }`
                    }>
                    <CheckIcon className="hidden ui-selected:block" />
                    {url}
                  </Combobox.Option>
                ))}
              </Combobox.Options>
            </Combobox>
          )}
        </div>
      </div>
      <div className='flex flex-col mt-4'>
        <button className='rounded border border-black py-1 px-2' onClick={() => createNewSigner()}>Create Signer</button>
        <div className='flex flex-row'>
          <button className='rounded border border-black py-1 px-2' onClick={() => authorize()}>Authorize</button>
          <input className='w-72 px-2 rounded border border-black' type='email' onChange={(e) => setAuthorizeEmail(e.target.value)} />
        </div>
        <button className='rounded border border-black py-1 px-2' onClick={() => claim()}>Claim</button>
      </div>
      {loading && <ArrowPathIcon className='animate-spin' />}

      {receipt && <Tab.Group className='mt-2' as='div'>
        <Tab.List>
          {hasDelegationsTab && (
            <Tab className='p-1 border border-black'>Delegations</Tab>
          )}
          <Tab className='p-1 border border-black'>Result</Tab>
          <Tab className='p-1 border border-black'>Receipt</Tab>
        </Tab.List>
        <Tab.Panels>
          {hasDelegationsTab && (
            <Tab.Panel>
              <pre>
                {jsonify(resultDelegations)}
              </pre>
            </Tab.Panel>
          )}
          <Tab.Panel>
            <pre>
              {jsonify(result)}
            </pre>
          </Tab.Panel>
          <Tab.Panel>
            <pre>
              {jsonify(receipt)}
            </pre>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
      }
    </main >
  )
}
