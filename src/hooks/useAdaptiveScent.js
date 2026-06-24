import { useEffect, useMemo, useState } from 'react'
import {
  fetchForecastForCurrentLocation,
  fetchForecastForDefaultLocation,
} from '../services/weatherService.js'
import { buildAdaptiveScentData } from '../utils/scentMatcher.js'

function getLocationErrorMessage(error) {
  if (error?.code === 1) {
    return 'Location permission was denied. You can use the default location or continue without Adaptive Scent.'
  }
  if (error?.code === 2) {
    return 'Your location is currently unavailable. You can use the default location instead.'
  }
  if (error?.code === 3) {
    return 'Location request timed out. You can try the default location instead.'
  }
  return error?.message || 'Unable to load weather data right now.'
}

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
        setStatus({ loading: true, error: '', usingDefault: false })
        const data = await fetchForecastForCurrentLocation()
        if (!active) return
        setForecast(data)
        setStatus({ loading: false, error: '', usingDefault: false })
      } catch (error) {
        if (!active) return
        setStatus({
          loading: false,
          error: getLocationErrorMessage(error),
          usingDefault: false,
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

  const useDefaultLocation = async () => {
    try {
      setEnabled(true)
      setStatus({ loading: true, error: '', usingDefault: true })
      const data = await fetchForecastForDefaultLocation()
      setForecast(data)
      setStatus({ loading: false, error: '', usingDefault: true })
    } catch (error) {
      setStatus({
        loading: false,
        error: getLocationErrorMessage(error),
        usingDefault: true,
      })
    }
  }

  const adaptiveData = useMemo(
    () => buildAdaptiveScentData(products, forecast),
    [products, forecast]
  )

  return {
    adaptiveData,
    enabled,
    setAdaptiveEnabled,
    status,
    useDefaultLocation,
  }
}

export default useAdaptiveScent
