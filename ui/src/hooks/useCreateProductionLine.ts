import { useState } from "react";
import { CreateProductionLineDto, ProductionLineDto } from "../types/production";
import { createProductionLine } from "../services/productionLinesService";

export default function useCreateProductionLine() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = async (dto: CreateProductionLineDto): Promise<ProductionLineDto> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await createProductionLine(dto);
            return result;
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || "Error creating production line";
            setError(msg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return { execute, isLoading, error };
}
