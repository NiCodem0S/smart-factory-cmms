export interface ProductionLineDto {
    id: string
    name: string
    status: string
    orderInHall: number | null
    lastStatusChangedAt: string | null
    factoryHallId: string
    currentProductId: string;
}