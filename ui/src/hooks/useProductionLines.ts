import { useState, useEffect } from "react"
import { ProductionLineDto } from "../types/production"
import { fetchLinesByHallId } from "../services/productionLinesService"

export default function useProductionLinesByHallsId(id: string) {
    const [data, setData] = useState<ProductionLineDto[]>()
}
