export interface ProductionLineDto {
    id: string
    name: string
    status: string
    orderInHall: number | null
    lastStatusChangedAt: string | null
    factoryHallId: string
    currentProductId?: string | null;
}

export interface CreateProductionLineDto {
    name: string
    status: string
    orderInHall?: number | null
    factoryHallId: string
    currentProductId?: string | null
}