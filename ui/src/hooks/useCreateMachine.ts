import { useState } from "react";
import { CreateMachineDto } from "../types/machine"
import { createMachine } from "../services/machineService";

export default function useCreateMachine() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = async (dto: CreateMachineDto) => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await createMachine(dto);
            return result;
        } catch (err: any) {
            setError(err.message || "Error durning posting data");
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return { execute, isLoading, error };
}