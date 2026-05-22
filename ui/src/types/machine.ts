
export type MachineStatus = 'Running' | 'Stopped' | 'Maintenance' | 'Offline';

export interface MachineListDto{
    id: string;
    name: string;
    category: string;
    serialNumber: string;
    status: MachineStatus;
    installationDate: string;
    activeWorkOrdersCount: number;
    lastTelemetryReading: string | null;
}