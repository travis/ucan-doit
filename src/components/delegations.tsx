import { useDatabase, useDelegations } from "@/hooks"
import { Disclosure } from "@headlessui/react"
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Delegation } from "@ucanto/interface"


function Delegation ({ delegation }: { delegation: Delegation }) {
  return (
    <div className='flex flex-col py-4'>
      <Disclosure>
        {({ open }) => (
          <>
            <Disclosure.Button className={`flex flex-row items-center w-full ${open ? 'rounded-t' : 'rounded'} bg-pink-100 px-4 py-2 text-left font-medium text-pink-900 hover:bg-pink-200 focus:outline-none focus-visible:ring focus-visible:ring-pink-500 focus-visible:ring-opacity-75`}>
              <ChevronRightIcon className={`shrink-0 mr-2 w-6 h-6 text-pink-500 ${open ? 'rotate-90 transform' : ''}`} />
              <div className='overflow-x-hidden text-ellipsis'>{delegation.asCID.toString()}</div>
            </Disclosure.Button>
            <Disclosure.Panel className='p-4 border-2 border-pink-100 rounded-b'>
              <h4 className='font-bold text-lg mt-2'>Issuer</h4>
              <div className='overflow-x-hidden text-ellipsis'>{delegation.issuer.did()}</div>
              <h4 className='font-bold text-lg mt-2'>Audience</h4>
              <div className='overflow-x-hidden text-ellipsis'>{delegation.audience.did()}</div>
              <h4 className='font-bold text-lg mt-2'>Capabilities</h4>
              {delegation.capabilities.map(capability => (
                <div className='ml-4'>
                  <span className='font-semibold'>{capability.can}</span>
                  &nbsp;on&nbsp;
                  <span className='font-semibold'>{capability.with}</span>
                  {!!capability.nb && (
                    <>
                      &nbsp;given&nbsp;
                      <pre className='font-semibold'>
                        {JSON.stringify(capability.nb)}
                      </pre>
                    </>
                  )}
                </div>
              ))}
              {delegation.proofs && (delegation.proofs.length > 0) && (
                <>
                  <h4 className='font-bold text-lg mt-2'>Proofs</h4>
                  {delegation.proofs.map((proof, i) => (
                    <Delegation key={i} delegation={proof as Delegation} />
                  ))}
                </>
              )}
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
    </div>
  )
}


export default function Delegations () {
  const db = useDatabase()
  const { delegations } = useDelegations(db)

  return (
    <div className='flex flex-col space-y-4'>
      {delegations && delegations.map((delegation, i) => (
        <Delegation
          key={i}
          delegation={delegation} />
      ))}
    </div>
  )
}