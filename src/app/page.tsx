'use client'

import { Tab } from '@headlessui/react'
import Invocations from '@/components/invocations'
import Delegations from '@/components/delegations'
import Actors from '@/components/actors'


export default function Home () {
  return (
    <main className="flex min-h-screen flex-col items-start px-24 pb-24 pt-8 w-screen space-y-4 font-mono bg-gray-200 dark:bg-gray-800">
      <h3 className='text-4xl font-bold'>UCAN DOIT!</h3>
      <Tab.Group className='mt-2 w-full relative' as='div' defaultIndex={2}>
        <Tab.List>
          <Tab className='tab'>Invocations</Tab>
          <Tab className='tab'>Delegations</Tab>
          <Tab className='tab'>Actors</Tab>
        </Tab.List>
        <Tab.Panels>
          <Tab.Panel>
            <Invocations />
          </Tab.Panel>
          <Tab.Panel>
            <Delegations />
          </Tab.Panel>
          <Tab.Panel>
            <Actors />
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </main >
  )
}
