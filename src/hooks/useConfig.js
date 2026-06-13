import { useEffect, useState } from 'react'
import { loadConfig } from '../firebase/planillas'
import { DEFAULT_CONFIG } from '../data/defaults'

export function useConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    loadConfig()
      .then((c) => active && setConfig(c))
      .catch(() => active && setConfig(DEFAULT_CONFIG))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  return { config, loading }
}
