import { useState } from "react"
import { PencilSquareIcon as EditIcon } from "@heroicons/react/20/solid"
import { Actor, setActorName as saveActorNameToDb } from "@/database"
import { useDatabase, useActors } from "@/hooks"

function Actor ({ actor, setName }: { actor: Actor, setName: (actor: Actor, name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [actorName, setActorName] = useState(actor.name)
  async function saveActorName () {
    await setName(actor, actorName)
    setEditing(false)
  }
  return (
    <div className='mt-2'>
      {editing ? (
        <div className='flex flex-row space-x-2 items-center'>
          <input type='text' placeholder='Name' value={actorName}
            onChange={e => { setActorName(e.target.value) }}
            onKeyDown={e => { if (e.key === 'Enter') saveActorName() }} />
          <button className='btn' onClick={() => { saveActorName() }}>Save</button>
        </div>
      ) : (
        <div>
          <div className='flex flex-row space-x-2 items-center'>
            <h4>{actor.name}</h4>
            <button>
              <EditIcon className='w-6 h-6 btn-hover p-1 rounded' onClick={() => { setEditing(true) }} />
            </button>
          </div>
          {actor.name !== actor.did() && (<h5 className='text-xs'>{actor.did()}</h5>)}
        </div >
      )}
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