import { useEffect, useRef, useState } from 'react'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { getLiveAccessToken } from '../services/apiClient'
import type { MachineSimState } from '../types/simulation'

export function useTelemetrySubscription(
    onState: (state: MachineSimState) => void,
    options: { machineId?: string; hallIds?: string[]; onReconnect?: () => void },
) {
    const callback = useRef(onState)
    callback.current = onState
    const reconnect = useRef(options.onReconnect)
    reconnect.current = options.onReconnect
    const [connectionStatus, setConnectionStatus] = useState('Connecting…')
    const hallKey = [...(options.hallIds ?? [])].sort().join(',')
    const machineId = options.machineId

    useEffect(() => {
        let disposed = false
        let retry: ReturnType<typeof setTimeout> | undefined
        const configured = String(import.meta.env.VITE_API_BASE_URL)
        const root = configured.replace(/\/api\/?$/i, '').replace(/\/$/, '')
        const connection = new HubConnectionBuilder()
            .withUrl(root + '/hubs/telemetry', { accessTokenFactory: getLiveAccessToken, withCredentials: true })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: context =>
                    Math.min(30000, 1000 * 2 ** Math.min(context.previousRetryCount, 5)),
            })
            .configureLogging(LogLevel.Error)
            .build()

        async function subscribe() {
            if (machineId) {
                await connection.invoke('JoinMachine', machineId)
            } else {
                for (const hallId of hallKey.split(',').filter(Boolean)) {
                    await connection.invoke('JoinHall', hallId)
                }
            }

            if (!disposed) {
                setConnectionStatus('Live')
                reconnect.current?.()
            }
        }

        function retryStart(status: string) {
            if (disposed) {
                return
            }
            setConnectionStatus(status)
            clearTimeout(retry)
            retry = setTimeout(start, 5000)
        }

        connection.on('ReceiveTelemetry', (state: MachineSimState) => {
            if (!disposed) {
                callback.current(state)
            }
        })
        connection.onreconnecting(() => {
            if (!disposed) {
                setConnectionStatus('Reconnecting…')
            }
        })
        connection.onreconnected(async () => {
            try {
                await subscribe()
            } catch {
                if (!disposed) {
                    setConnectionStatus('Subscription access denied')
                }
            }
        })
        connection.onclose(() => retryStart('Disconnected'))

        async function start() {
            try {
                await connection.start()
                if (disposed) {
                    await connection.stop()
                    return
                }
                await subscribe()
            } catch {
                if (!disposed) {
                    await connection.stop()
                    retryStart('Waiting for connection…')
                }
            }
        }

        void start()
        return () => {
            disposed = true
            clearTimeout(retry)
            void connection.stop()
        }
    }, [machineId, hallKey])

    return connectionStatus
}
