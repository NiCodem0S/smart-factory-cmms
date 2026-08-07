export interface FactoryHallListDto {
    id: string
    name: string
}

export interface ProductionLineListDto {
    id: string
    name: string
    status: string
    factoryHallId: string
}
