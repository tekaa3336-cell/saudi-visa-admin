import { useState } from 'react'
import { Plus } from 'lucide-react'
import ApplicationsTable from '../components/ApplicationsTable'
import NewApplicationModal from '../components/NewApplicationModal'

export default function Applications({ rows, loading, error, reload, onOpen, onUpdate, onDelete, onCreate, notify, services }) {
  const [adding, setAdding] = useState(false)
  return (
    <>
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} />New application</button></div>
      <ApplicationsTable rows={rows} loading={loading} error={error} reload={reload} onOpen={onOpen} onUpdate={onUpdate} onDelete={onDelete} notify={notify} />
      {adding && <NewApplicationModal services={services} onCreate={onCreate} onClose={() => setAdding(false)} notify={notify} />}
    </>
  )
}
