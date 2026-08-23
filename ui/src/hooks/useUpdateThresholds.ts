import { useState } from 'react';
import { CreateAlertThresholdsDto } from '../types/machine';
import { updateMachineTresholds } from '../services/machineService';

export default function useUpdateThresholds() {
    const [isSaving, setIsSaving] = useState(false)
    const [errorThresholds, setError] = useState<string | null>(null)

    const execute = async (machineId: string, tresholds: CreateAlertThresholdsDto[]) => {
        setIsSaving(true);
        setError(null);

        try {
            await updateMachineTresholds(machineId, tresholds);
        } catch (err: any) {
            const message = err.response?.data?.message || err.message || 'Failed to update thresholds';
            setError(message);
            throw err;
        } finally {
            setIsSaving(false);
        }
    }

    return { execute, isSaving, errorThresholds };
}