'use client'

import { useEffect, useState, useMemo } from 'react'
import { Combobox } from '@headlessui/react'

import { Ability, DID, Delegation, InvocationOptions, Receipt, Result } from '@ucanto/interface'
import { ConnectionView, connect } from '@ucanto/client'
import { Absentee } from '@ucanto/principal'
import * as HTTP from '@ucanto/transport/http'
import * as CAR from '@ucanto/transport/car'
import { invoke } from '@ucanto/core'
import * as DidMailto from '@web3-storage/did-mailto'
import { useDatabase, useDelegations, useServerEndpoints, useServerPrincipals, useSigners } from '@/hooks'
import { bytesToDelegations } from '@web3-storage/access/encoding'
import { ArrowPathIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'
import { Tab } from '@headlessui/react'
import useLocalStorageState from 'use-local-storage-state'
import { Link } from '@ucanto/core/schema'

function jsonify (a: any) {
  return a ? JSON.stringify(a, null, 4) : ''
}

function jsonOrNull (s: string) {
  try {
    return JSON.parse(s)
  } catch (e) {
    return null
  }
}

function parseCIDsInNb (nb: Record<string, unknown>) {
  const parsedNb: Record<string, unknown> = {}
  for (const key in nb) {
    const value = nb[key]
    if (typeof value === 'string' && value.startsWith('bagbaiera')) {
      parsedNb[key] = Link.parse(value)
    } else {
      parsedNb[key] = value
    }
  }
  return parsedNb
}

function invocationToString (invocation: InvocationOptions) {
  return JSON.stringify({
    issuer: invocation.issuer?.did(),
    audience: invocation.audience?.did(),
    capability: invocation.capability,
    proofs: invocation.proofs
  }, null, 2)
}

export default function Home () {

  const [loading, setLoading] = useState(false)

  const { data: endpointUrls } = useServerEndpoints()
  const [selectedEndpointQuery, setSelectedEndpointQuery] = useState('')
  const filteredEndpointUrls = endpointUrls?.filter(u => u.startsWith(selectedEndpointQuery))
  const [selectedEndpointUrl, setSelectedEndpointUrl] = useLocalStorageState<string>('selected-endpoint')
  useEffect(() => {
    if (!selectedEndpointUrl && endpointUrls && (endpointUrls.length > 0)) {
      setSelectedEndpointUrl(endpointUrls[0])
    }
  }, [endpointUrls])
  const url = useMemo(() => selectedEndpointUrl && new URL(selectedEndpointUrl), [selectedEndpointUrl])

  const { dids: serverPrincipalDids } = useServerPrincipals()
  const [selectedPrincipalQuery, setSelectedPrincipalQuery] = useState('')
  const filteredPrincipalDids = serverPrincipalDids?.filter(d => d.startsWith(selectedPrincipalQuery))
  const [selectedPrincipalDid, setSelectedPrincipalDid] = useLocalStorageState<string>('selected-principal')
  useEffect(() => {
    if (!selectedPrincipalDid && serverPrincipalDids && (serverPrincipalDids.length > 0)) {
      setSelectedPrincipalDid(serverPrincipalDids[0])
    }
  }, [serverPrincipalDids])
  const serverPrincipal = useMemo(() => selectedPrincipalDid ? Absentee.from({ id: selectedPrincipalDid as DID }) : undefined, [selectedPrincipalDid])

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
  const [selectedAgentDid, setSelectedAgentDid] = useLocalStorageState('selected-agent', { defaultValue: '' })
  // if selectedAgentDid is '', use the first signer we find, otherwise search for a matching DID
  const agentPrincipal = signers?.find(s => (selectedAgentDid === '') || (s.did() === selectedAgentDid))

  const [receipt, setRawReceipt] = useState<Receipt | undefined>()
  const [result, setResult] = useState<Result | undefined>()
  const [invocation, setInvocation] = useState<InvocationOptions | undefined>()
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
      const invocation: InvocationOptions = {
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
      }
      setInvocation(invocation)
      setReceipt(
        await invoke(invocation).execute(client)
      )
      setLoading(false)
    }
  }

  async function claim () {
    if (client && agentPrincipal && serverPrincipal) {
      setLoading(true)
      setReceipt(undefined)
      const invocation: InvocationOptions = {
        issuer: agentPrincipal,
        audience: serverPrincipal,
        capability: {
          can: 'access/claim',
          with: agentPrincipal.did()
        }
      }
      setInvocation(invocation)
      setReceipt(
        await invoke(invocation).execute(client)
      )
      setLoading(false)
    }
  }
  const { delegations: availableProofs, putDelegations, clearAll: clearAllDelegations } = useDelegations(db)
  const [selectedProofsStore, setSelectedProofsStore] = useLocalStorageState<Record<string, boolean>>('selected-proofs', { defaultValue: {} })
  function toggleProof (cid: string) {
    setSelectedProofsStore(currentSelections => {
      currentSelections[cid] = !currentSelections[cid]
      return currentSelections
    })
  }
  const selectedProofCIDs = Object.entries(selectedProofsStore).reduce<string[]>((m, [proof, include]) => {
    if (include) {
      m.push(proof)
    }
    return m
  }, [])
  const selectedProofs = selectedProofCIDs.map(cid => availableProofs?.find(proof => proof.asCID.toString() === cid)!)

  const [capabilityName, setCapabilityName] = useLocalStorageState<string>('capability-name', { defaultValue: '' })
  const ability = (capabilityName == '*' || capabilityName?.match('.*/.*')) ? capabilityName as Ability : null
  const [resourceName, setResourceName] = useLocalStorageState<string>('resource-name', { defaultValue: '' })
  const resourceUri = (resourceName?.match('.*:.*')) ? resourceName as `${string}:${string}` : null
  const [inputs, setInputs] = useLocalStorageState<string>('inputs', { defaultValue: '' })
  const inputsJSON = parseCIDsInNb(jsonOrNull(inputs))
  // intentionally claiming all these are not null with !
  // TODO: replace InvocationOptions with a similar type with nullable fields
  const customInvocation: InvocationOptions = {
    issuer: agentPrincipal!,
    audience: serverPrincipal!,
    capability: {
      can: ability!,
      with: resourceUri!,
    },
    proofs: selectedProofs
  }

  if (inputsJSON) {
    customInvocation.capability.nb = inputsJSON
  }


  async function execute () {
    if (client && agentPrincipal && serverPrincipal && ability && resourceUri) {
      setLoading(true)
      setReceipt(undefined)
      setInvocation(customInvocation)
      setReceipt(
        await invoke(customInvocation).execute(client)
      )
      setLoading(false)
    }
  }

  async function createNewSigner () {
    setLoading(true)
    await createSigner()
    setLoading(false)
  }

  const hasSaveableDelegations = db && resultDelegations
  async function saveDelegations () {
    if (hasSaveableDelegations) {
      putDelegations(resultDelegations)
    }
  }

  const hasDelegationsTab = resultDelegations && resultDelegations.length > 0
  return (
    <main className="flex min-h-screen flex-col items-start px-24 pb-24 pt-8 w-screen space-y-4 font-mono">
      <h3 className='text-4xl font-bold'>UCAN DOIT!</h3>
      <div className='flex flex-row items-center space-x-2'>
        <h4 className='w-24 text-xl'>Actor:</h4>
        {agentPrincipal && (
          <Combobox value={agentPrincipal.did()} onChange={setSelectedAgentDid} as='div' className='relative mt-1 w-[32rem] z-10'>
            <div className="relative w-full cursor-default overflow-hidden bg-white text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 sm:text-sm">
              <Combobox.Input
                onChange={(event) => setSelectedAgentQuery(event.target.value)}
                autoComplete='off'
                className="w-full rounded border border-black dark:border-white py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
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
                  {signer.did()}
                </Combobox.Option>
              ))}
            </Combobox.Options>
          </Combobox>
        )}
        <button className={agentPrincipal ? 'btn' : `rounded py-1 px-2 border-2 border-pink-500 dark:border-pink-500 text-pink-500 font-bold hover:bg-gray-200`} onClick={() => createNewSigner()}>Create&nbsp;Signer</button>
      </div>
      <div className='flex flex-row items-center space-x-2'>
        <h4 className='w-24 text-xl'>Server:</h4>
        <div className='flex flex-row items-center space-x-2'>
          {selectedPrincipalDid && (
            <Combobox value={selectedPrincipalDid} onChange={setSelectedPrincipalDid} as='div' className='relative mt-1 w-72'>
              <div className="relative w-full cursor-default overflow-hidden bg-white text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 sm:text-sm">
                <Combobox.Input
                  onChange={(event) => setSelectedPrincipalQuery(event.target.value)}
                  autoComplete='off'
                  className="w-full rounded border border-black dark:border-white py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
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
                    {did}
                  </Combobox.Option>
                ))}
              </Combobox.Options>
            </Combobox>
          )}
          <span>@</span>
          {selectedEndpointUrl && (
            <Combobox value={selectedEndpointUrl} onChange={setSelectedEndpointUrl} as='div' className='relative mt-1 w-96'>
              <div className="relative w-full cursor-default overflow-hidden bg-white text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 sm:text-sm">
                <Combobox.Input
                  onChange={(event) => setSelectedEndpointQuery(event.target.value)}
                  autoComplete='off'
                  className="w-full rounded border border-black dark:border-white py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
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
                    {url}
                  </Combobox.Option>
                ))}
              </Combobox.Options>
            </Combobox>
          )}
        </div>
      </div>
      <div className='flex flex-row items-center space-x-1 border-t border-b border-black dark:border-white py-4 w-full'>
        <div className='flex flex-row'>
          <button className='btn rounded-r-none' onClick={() => authorize()}>Authorize</button>
          <input className='w-72 px-2 rounded-r border border-black dark:border-white dark:text-black dark:border-white focus:ring-0 focus:outline-none' placeholder='Email' type='email' onChange={(e) => setAuthorizeEmail(e.target.value)} />
        </div>
        <button className='btn' onClick={() => claim()}>Claim&nbsp;Delegations</button>
      </div>
      <div className='flex-col items-start border-b border-black dark:border-white pb-4 w-full'>
        <div className='flex flex-row space-x-1 mb-1 w-full'>
          <div className='flex-grow flex flex-col space-y-1'>
            <h4 className='text-lg'>Invoke and Execute</h4>
            <input className='ipt' placeholder='Ability' type='text' value={capabilityName} onChange={(e) => setCapabilityName(e.target.value)} />
            <input className='ipt' placeholder='Resource' type='text' value={resourceName} onChange={(e) => setResourceName(e.target.value)} />
            <textarea className='ipt' placeholder='Inputs (JSON)' value={inputs} onChange={(e) => setInputs(e.target.value)}></textarea>
          </div>
          <div className='flex-grow flex flex-col space-y-1'>
            <h4 className='text-lg'>With&nbsp;Proofs</h4>
            <div className='flex flex-col space-y-2 h-full rounded border border-black dark:border-white bg-gray-100 p-2'>
              {availableProofs?.map(delegation => {
                const cid = delegation.asCID.toString()
                return (
                  <div className='flex flex-row items-center' key={cid}>
                    <input className='accent-pink-500 h-4 w-4 m-1' type='checkbox'
                      checked={selectedProofsStore[cid]}
                      onChange={e => toggleProof(cid)} />
                    <div className='flex flex-col relative'>
                      <h4 className='w-48 overflow-hidden text-ellipsis'>{cid}</h4>
                      <div className='text-sm'>
                        {delegation.capabilities.map((capability, i) => (
                          <span key={i}>{capability.can} </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <button className='btn w-full' onClick={() => execute()}>Do it!</button>
        {customInvocation && (
          <pre className='rounded border border-black dark:border-white bg-gray-100 py-1 px-2 dark:text-black dark:border-white mt-2 overflow-x-scroll w-full max-h-64'>
            {invocationToString(customInvocation)}
          </pre>
        )}
      </div>
      {loading && <ArrowPathIcon className='animate-spin dark:text-white w-24 h-24' />}

      {receipt && <Tab.Group className='mt-2' as='div'>
        <Tab.List>
          {hasDelegationsTab && (
            <Tab className='px-1 border border-black dark:border-white ui-selected:bg-gray-100 dark:ui-selected:bg-gray-500'>Delegations</Tab>
          )}
          <Tab className='px-1 border border-black dark:border-white ui-selected:bg-gray-100 dark:ui-selected:bg-gray-500'>Result</Tab>
          <Tab className='px-1 border border-black dark:border-white ui-selected:bg-gray-100 dark:ui-selected:bg-gray-500'>Receipt</Tab>
          {invocation && (
            <Tab className='px-1 border border-black dark:border-white ui-selected:bg-gray-100 dark:ui-selected:bg-gray-500'>Invocation</Tab>
          )}
        </Tab.List>
        <Tab.Panels>
          {hasDelegationsTab && (
            <Tab.Panel>
              <div className='my-1 space-x-1'>
                <button className='rounded border border-black dark:border-white px-1 text-sm' disabled={!hasSaveableDelegations} onClick={() => { saveDelegations() }}>
                  Save Delegations
                </button>
                <button className='rounded border border-black dark:border-white px-1 text-sm' onClick={() => { clearAllDelegations() }}>
                  Clear All Delegations
                </button>
              </div>
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
          {invocation && (
            <Tab.Panel>
              <pre>
                {invocationToString(invocation)}
              </pre>
            </Tab.Panel>
          )}
        </Tab.Panels>
      </Tab.Group>
      }
    </main >
  )
}
