import { useState } from "react"
import Header from "../layout/Header";
import useProductionLinesByHallsId from "../../hooks/useProductionLines";

export default function ProductionLines() {
    const [page, setPage] = useState<number>(1)
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    //const { data, isLoading, error, refetch } useProductionLinesByHallsId()
}