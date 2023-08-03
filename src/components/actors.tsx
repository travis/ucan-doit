import { useState } from "react"
import { ChevronRightIcon, ChevronUpDownIcon, PencilSquareIcon as EditIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { Actor } from "@/database"

import { useDatabase, useActors, useDelegations } from "@/hooks"
import { Combobox, Disclosure } from "@headlessui/react"
import { Ability, Capabilities, Capability, Delegation, DelegationOptions } from "@ucanto/interface"
import { delegate } from '@ucanto/core'
import { jsonOrNull, parseCIDsInNb } from '@/app/util/ucans'
import DateTimePicker from 'react-datetime-picker'
import 'react-datetime-picker/dist/DateTimePicker.css'
import 'react-calendar/dist/Calendar.css'
import 'react-clock/dist/Clock.css'

function CapabilityCreator ({ onAdd }: { onAdd: (capability: Capability) => void }) {
  const [capabilityName, setCapabilityName] = useState<string>('')
  const ability = (capabilityName == '*' || capabilityName?.match('.*/.*')) ? capabilityName as Ability : null
  const [resourceName, setResourceName] = useState<string>('')
  const resourceUri = (resourceName?.match('.*:.*')) ? resourceName as `${string}:${string}` : null
  const [caveats, setCaveats] = useState<string>('')
  const inputsJSON = parseCIDsInNb(jsonOrNull(caveats))

  const capability: Capability = {
    can: ability!,
    with: resourceUri!,
    nb: inputsJSON
  }
  const validCapability = ability && resourceUri

  return (
    <div className='flex flex-col'>
      <div className='flex flex-row'>
        <div className='flex flex-col'>
          <input className='ipt' placeholder='Ability' type='text' value={capabilityName} onChange={(e) => setCapabilityName(e.target.value)} />
          <input className='ipt' placeholder='Resource' type='text' value={resourceName} onChange={(e) => setResourceName(e.target.value)} />
          <textarea className='ipt flex-grow' placeholder='Caveats (JSON)' value={caveats} onChange={(e) => setCaveats(e.target.value)}></textarea>
        </div>
        <pre className='rounded border border-black dark:border-white bg-gray-100 py-1 px-2 dark:text-black dark:border-white overflow-x-scroll w-full max-h-64'>
          {JSON.stringify(capability, null, 4)}
        </pre>
      </div>
      <button className='btn' disabled={!validCapability} onClick={() => { onAdd(capability) }}>Add</button>
    </div>
  )
}

function DelegationCreator ({ actor }: { actor: Actor }) {
  const db = useDatabase()
  const { actors } = useActors(db)
  const [selectedToActorQuery, setSelectedToActorQuery] = useState('')
  const filteredToActors = actors?.filter(s => (s.did() !== actor?.did()) && s.did().startsWith(selectedToActorQuery))
  const [selectedToActorDid, setSelectedToActorDid] = useState('')
  const toActorPrincipal = actors?.find(s => (selectedToActorDid === '') || (s.did() === selectedToActorDid)) || actors?.[0]

  const [addingCapability, setAddingCapability] = useState(false)
  const [capabilities, setCapabilities] = useState<Capability[]>([])

  const { delegations: availableProofs, putDelegations } = useDelegations(db)
  const [selectedProofsStore, setSelectedProofsStore] = useState<Record<string, boolean>>({})
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
  const [expirationDate, setExpirationDate] = useState<Date | null>(new Date());
  const delegationOptions: DelegationOptions<Capabilities> = {
    issuer: actor,
    audience: toActorPrincipal,
    capabilities: capabilities as Capabilities,
    proofs: selectedProofs,
    expiration: expirationDate ? parseInt((expirationDate.getTime() / 1000).toFixed(0)) : undefined
  }
  async function createAndStoreDelegation () {
    const delegation = await delegate(delegationOptions)
    await putDelegations([delegation])
  }
  return (
    <div>
      <h5 className='font-bold text-lg'>To:</h5>
      {actors && (actors.length > 0) && (
        <Combobox value={toActorPrincipal.name} onChange={setSelectedToActorDid} as='div' className='relative mt-1 w-[32rem]'>
          <div className="relative w-full cursor-default overflow-hidden bg-white text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 sm:text-sm">
            <Combobox.Input
              onChange={(event) => setSelectedToActorQuery(event.target.value)}
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
          <Combobox.Options className="z-10 absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {filteredToActors?.map(actor => (
              <Combobox.Option key={actor.did()} value={actor.did()}
                className={({ active }) =>
                  `relative cursor-default select-none py-2 pl-4 pr-4 ${active ? 'bg-teal-600 text-white' : 'text-gray-900'}`
                }>
                {actor.name}
              </Combobox.Option>
            ))}
          </Combobox.Options>
        </Combobox>
      )}
      <h5 className='font-bold text-lg'>Expiration:</h5>
      <DateTimePicker className=' text-black' onChange={setExpirationDate} value={expirationDate} />
      <h5 className='font-bold text-lg'>Capabilities:</h5>
      <div className='flex flex-row'>
        {capabilities.map((capability, i) => (
          <div className='relative max-w-xs border-2 border-pink-100 p-4 rounded' key={i}>
            <div className='flex flex-col'>
              <div>{capability.can}</div>
              <div className='text-ellipsis overflow-hidden'>{capability.with}</div>
              <pre>{JSON.stringify(capability.nb, null, 4) || ''}</pre>
            </div>
            <button className='btn-hover w-6 h-6 text-pink-100 absolute top-0 right-0'
              onClick={() => { capabilities.splice(i, 1); setCapabilities(capabilities) }} >
              <XMarkIcon />
            </button>
          </div>
        ))}
      </div>
      {
        addingCapability ? (
          <CapabilityCreator onAdd={c => { setCapabilities(cs => [c, ...cs]); setAddingCapability(false) }} />
        ) : (
          <button className='btn' onClick={() => setAddingCapability(true)}>
            Add Capability
          </button>
        )
      }
      <h5 className='font-bold text-lg'>With Proofs:</h5>
      <div className='flex flex-col space-y-2 h-full rounded border border-black dark:border-white bg-gray-100 dark:bg-gray-900 p-2'>
        {availableProofs?.map(delegation => {
          const cid = delegation.asCID.toString()
          return (
            <div className='flex flex-row items-center' key={cid}>
              <input className='accent-pink-500 h-4 w-4 m-1' type='checkbox'
                checked={selectedProofsStore[cid]}
                onChange={e => toggleProof(cid)} />
              <div className={`flex flex-col relative ${delegation.audience.did() === actor.did() ? 'text-green-500' : ''}`}>
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
      <button className='btn' onClick={() => createAndStoreDelegation()}>
        Delegate
      </button>
    </div >
  )
}

function Actor ({ actor, setName }: { actor: Actor, setName: (actor: Actor, name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [actorName, setActorName] = useState(actor.name)
  async function saveActorName () {
    await setName(actor, actorName)
    setEditing(false)
  }

  return (
    <div className='mt-2'>
      <Disclosure>
        {({ open }) => (
          <>
            <Disclosure.Button className={`flex flex-row items-center w-full ${open ? 'rounded-t' : 'rounded'} bg-pink-100 px-4 py-2 text-left font-medium text-pink-900 hover:bg-pink-200 focus:outline-none focus-visible:ring focus-visible:ring-pink-500 focus-visible:ring-opacity-75`}>
              <ChevronRightIcon className={`shrink-0 mr-2 w-6 h-6 text-pink-500 ${open ? 'rotate-90 transform' : ''}`} />
              {actor.name}
            </Disclosure.Button>
            <Disclosure.Panel className='p-4 border-2 border-pink-100 rounded-b'>
              <h4 className='font-bold text-xl mt-2'>Name</h4>
              {editing ? (
                <div className='flex flex-row space-x-2 items-center'>
                  <input type='text' placeholder='Name' value={actorName}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { setActorName(e.target.value) }}
                    onKeyDown={e => { if (e.key === 'Enter') saveActorName() }} />
                  <button className='btn'
                    onClick={(e) => { e.stopPropagation(); saveActorName() }}>Save</button>
                </div>
              ) : (
                <div>
                  <div className='flex flex-row space-x-2 items-center'>
                    <h4>{actor.name}</h4>
                    <button className='btn-hover p-1 rounded'
                      onClick={e => { e.stopPropagation(); setEditing(true) }} >
                      <EditIcon className='w-4 h-4' />
                    </button>
                  </div>
                </div >
              )}
              <h4 className='font-bold text-xl mt-2'>DID</h4>
              <div>{actor?.did()}</div>
              <h4 className='font-bold text-xl mt-2'>Delegate</h4>
              <DelegationCreator actor={actor} />
            </Disclosure.Panel>
          </>
        )}
      </Disclosure >
    </div >
  )
}

export default function Actors () {
  const db = useDatabase()
  const { actors, setName: setActorName } = useActors(db)
  return (
    <div>
      {actors?.map(actor => (
        <Actor actor={actor} key={actor.did()} setName={setActorName} />
      ))}
    </div>
  )
}