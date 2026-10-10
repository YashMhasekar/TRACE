/**
 * PlantContext.jsx
 * Global plant + period selector.
 * All pages read activePlantId / activePeriod from here.
 * Changing plant triggers a query-key change which refetches everything.
 */
import { createContext, useContext, useState, useCallback } from 'react'
import plantsData from '@/data/plants.json'

const PlantContext = createContext(null)

export function PlantProvider({ children }) {
  const [activePlantId, setActivePlantId] = useState(
    plantsData.activePlantId ?? 'PLANT-002'
  )
  const [activePeriod] = useState(plantsData.activePeriod ?? 'May 2026')

  const selectPlant = useCallback((plantId) => {
    setActivePlantId(plantId)
  }, [])

  return (
    <PlantContext.Provider value={{ activePlantId, activePeriod, selectPlant }}>
      {children}
    </PlantContext.Provider>
  )
}

export function usePlantContext() {
  const ctx = useContext(PlantContext)
  if (!ctx) throw new Error('usePlantContext must be used within PlantProvider')
  return ctx
}
