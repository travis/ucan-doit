import { useDatabase, useActors } from "@/hooks"

export default function Agents () {
  const db = useDatabase()
  const { actors } = useActors(db)
  return (
    <div>
      {actors?.map(actor => (
        <div>
          <h4>{actor.name}</h4>
        </div>
      ))}
    </div>
  )
}