import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_LOCATION, fetchForecastForDefaultLocation } from '../services/weatherService.js'
import { buildAdaptiveScentData } from '../utils/scentMatcher.js'

function useAdaptiveScent(products = []) {
  const [enabled, setEnabled] = useState(false)
  const [forecast, setForecast] = useState(null)
  const [status, setStatus] = useState({
    loading: false,
    error: '',
    usingDefault: false,
  })

  useEffect(() => {
    if (!enabled || forecast || status.loading || status.error) return undefined

    let active = true
    const load = async () => {
      try {
        setStatus({ loading: true, error: '', usingDefault: true })
        const data = await fetchForecastForDefaultLocation()
        if (!active) return
        setForecast(data)
        setStatus({ loading: false, error: '', usingDefault: true })
      } catch (error) {
        if (!active) return
        setStatus({
          loading: false,
          error: error?.message || 'Unable to load Marinduque weather forecast right now.',
          usingDefault: true,
        })
      }
    }

    load()
    return () => {
      active = false
    }
  }, [enabled, forecast, status.error, status.loading])

  const setAdaptiveEnabled = (nextEnabled) => {
    setEnabled(nextEnabled)
    if (!nextEnabled) {
      setForecast(null)
      setStatus({ loading: false, error: '', usingDefault: false })
    }
  }

  const adaptiveData = useMemo(
    () => buildAdaptiveScentData(products, forecast),
    [products, forecast]
  )

  return {
    adaptiveData,
    enabled,
    locationLabel: DEFAULT_LOCATION.label,
    setAdaptiveEnabled,
    status,
  }
}

export default useAdaptiveScent
