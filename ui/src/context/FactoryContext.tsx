import { useState, createContext, useContext, useEffect } from "react";
import { FactoryHallDto } from "../types/factory";
import { useFactoryHalls } from "../hooks/useFactoryHalls";
import { useAuth } from "./AuthContext"

export interface FactoryContextType { //typ obiektu kontekstu który otrzyma kazdy komponent owinienty w provider
    selectedHallId: string | null,
    setSelectedHallId: (id: string | null) => void
    halls: FactoryHallDto[]
    isLoadingHalls: boolean
}

interface FactoryProviderProps {
    children: React.ReactNode;
}

export default function FactoryProvider({ children }: FactoryProviderProps) {

    const { data: halls = [], isLoading: isLoadingHalls } = useFactoryHalls()
    const [selectedHallId, setHallIdState] = useState<string | null>(() => {
        return sessionStorage.getItem("selectedHallId");
    })

    const { user } = useAuth();
    const isSuperAdmin = user?.role === "SuperAdmin";

    useEffect(() => {
        if (!user) {
            setHallIdState(null);
            sessionStorage.removeItem("selectedHallId");
            return;
        }
        if (!isSuperAdmin) {
            const hallId = user.factoryHallId || (halls.length > 0 ? halls[0].id : null);
            setHallIdState(hallId);
            if (hallId) {
                sessionStorage.setItem("selectedHallId", hallId);
            }
        }
    }, [user, isSuperAdmin, halls]);

    const setSelectedHallId = (id: string | null) => {
        if (!id) {
            sessionStorage.removeItem("selectedHallId")
            setHallIdState(null)
        }
        else {
            sessionStorage.setItem("selectedHallId", id)
            setHallIdState(id)
        }
    }

    return (
        <FactoryContext.Provider value={{ selectedHallId, setSelectedHallId, halls, isLoadingHalls }}>
            {children}
        </FactoryContext.Provider>
    )
}

export function useFactory() {
    const context = useContext(FactoryContext)

    if (!context) {
        throw new Error("useFactory must be used within a FactoryProvider")
    }

    return context;
}

export const FactoryContext = createContext<FactoryContextType | undefined>(undefined)