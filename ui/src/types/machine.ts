
export type MachineStatus = 'Running' | 'Stopped' | 'Maintenance' | 'Offline';

export interface MachineListDto{
    Id: string;
    Name: string;
    Category: string;
    SerialNumber: string;
    Status: MachineStatus;
    InstallationDate: string;
    ActiveWorkOrdersCount: number;
    LastTelemetryReading: string | null;
}