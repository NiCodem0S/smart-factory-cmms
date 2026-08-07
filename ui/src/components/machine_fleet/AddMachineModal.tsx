import ReactDOM from "react-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { CreateMachineDto } from "../../types/machine";
import { FactoryHallListDto, ProductionLineListDto } from "../../types/factory";
import useCreateMachine from "../../hooks/useCreateMachine";
import { useEffect, useState } from "react";

interface AddMachineModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface FormValues extends Omit<CreateMachineDto, "alertThresholds"> {
    tempWarning: number;
    tempCritical: number;
    vibWarning: number;
    vibCritical: number;
    powerWarning: number;
    powerCritical: number;
}

export default function AddMachineModal({ isOpen, onClose, onSuccess }: AddMachineModalProps) {
    if (!isOpen) return null;

    const { execute, isLoading: isCreating, error } = useCreateMachine();
    
    const [halls, setHalls] = useState<FactoryHallListDto[]>([]);
    const [lines, setLines] = useState<ProductionLineListDto[]>([]);
    const [isLoadingHalls, setIsLoadingHalls] = useState(false);
    const [isLoadingLines, setIsLoadingLines] = useState(false);

    useEffect(() => {
        setIsLoadingHalls(true);
        fetch('http://localhost:5240/api/FactoryHalls')
            .then(res => res.json())
            .then(data => setHalls(data))
            .catch(console.error)
            .finally(() => setIsLoadingHalls(false));
    }, []);
    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm<FormValues>({
        defaultValues: {
            cycleTimeSeconds: 5.0,
            orderInLine: 0,
            normTemp: 60.0,
            baseVib: 1.0,
            normPower: 15.0,
            status: "Offline",
            factoryHallId: "",
            tempWarning: 75.0,
            tempCritical: 90.0,
            vibWarning: 4.0,
            vibCritical: 6.0,
            powerWarning: 30.0,
            powerCritical: 45.0
        }
    });

    const selectedHallId = watch("factoryHallId");

    useEffect(() => {
        if (!selectedHallId) {
            setLines([]);
            return;
        }
        setIsLoadingLines(true);
        fetch(`http://localhost:5240/api/ProductionLines?factoryHallId=${selectedHallId}`)
            .then(res => res.json())
            .then(data => setLines(data))
            .catch(console.error)
            .finally(() => setIsLoadingLines(false));
    }, [selectedHallId]);

    const handleFormSubmit: SubmitHandler<FormValues> = async (formData) => {
        try {
            const dto: CreateMachineDto = {
                ...formData,
                productionLineId: formData.productionLineId || null,
                alertThresholds: [
                    { metricType: "Temperature", warningValue: Number(formData.tempWarning), criticalValue: Number(formData.tempCritical) },
                    { metricType: "Vibration", warningValue: Number(formData.vibWarning), criticalValue: Number(formData.vibCritical) },
                    { metricType: "PowerLoadKw", warningValue: Number(formData.powerWarning), criticalValue: Number(formData.powerCritical) },
                ]
            };

            await execute(dto);
            reset();
            onSuccess?.();
            onClose();
        } catch (err) {

        }
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md space-y-4">
                <div className="flex justify-between items-center pb-1">
                    <h2 className="text-xl font-bold text-slate-800">
                        Add New Machine
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 font-bold"
                    >
                        ✕
                    </button>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Name</label>
                        <input
                            type="text"
                            {...register("name", {
                                required: "Machine name is required",
                                maxLength: { value: 255, message: "Name cannot exceed 255 characters" }
                            })}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.name ? "border-red-500 focus:ring-red-500" : "border-slate-300 focus:ring-blue-500"
                                }`}
                        />
                        {errors.name && (
                            <span className="text-xs text-red-500 mt-1 block">
                                {errors.name.message}
                            </span>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                        <input
                            type="text"
                            {...register("category", {
                                required: "Category is required",
                                maxLength: { value: 127, message: "Category cannot exceed 127 characters" }
                            })}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.category ? "border-red-500 focus:ring-red-500" : "border-slate-300 focus:ring-blue-500"
                                }`}
                        />
                        {errors.category && (
                            <span className="text-xs text-red-500 mt-1 block">
                                {errors.category.message}
                            </span>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Serial Number</label>
                        <input
                            type="text"
                            {...register("serialNumber", {
                                required: "Serial number is required",
                                maxLength: { value: 127, message: "Serial number cannot exceed 127 characters" }
                            })}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.serialNumber ? "border-red-500 focus:ring-red-500" : "border-slate-300 focus:ring-blue-500"
                                }`}
                        />
                        {errors.serialNumber && (
                            <span className="text-xs text-red-500 mt-1 block">
                                {errors.serialNumber.message}
                            </span>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                        <select
                            {...register("status")}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="Running">Running</option>
                            <option value="Offline">Offline</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Error">Error</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Cycle Time (s)</label>
                            <input
                                type="number"
                                step="0.1"
                                {...register("cycleTimeSeconds", { required: true, min: 0.1 })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Order in Line</label>
                            <input
                                type="number"
                                {...register("orderInLine", { required: true, min: 0 })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Factory Hall</label>
                            <select
                                {...register("factoryHallId", { required: "Factory Hall is required" })}
                                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.factoryHallId ? "border-red-500 focus:ring-red-500" : "border-slate-300 focus:ring-blue-500"} bg-white`}
                            >
                                <option value="">Select Hall...</option>
                                {halls.map(hall => (
                                    <option key={hall.id} value={hall.id}>{hall.name}</option>
                                ))}
                            </select>
                            {errors.factoryHallId && (
                                <span className="text-xs text-red-500 mt-1 block">
                                    {errors.factoryHallId.message}
                                </span>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Production Line (Optional)</label>
                            <select
                                {...register("productionLineId")}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                disabled={!selectedHallId || isLoadingLines}
                            >
                                <option value="">None (Utility)</option>
                                {lines.map(line => (
                                    <option key={line.id} value={line.id}>{line.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Base Temp (°C)</label>
                            <input
                                type="number"
                                step="0.1"
                                {...register("normTemp", { required: true })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Base Vib (mm/s)</label>
                            <input
                                type="number"
                                step="0.1"
                                {...register("baseVib", { required: true })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Base Pwr (kW)</label>
                            <input
                                type="number"
                                step="0.1"
                                {...register("normPower", { required: true })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-700 mb-4">Alert Thresholds</h4>
                        
                        <div className="grid grid-cols-3 gap-6">
                            {/* Temperature Thresholds */}
                            <div className="space-y-3 bg-orange-50/50 p-3 rounded-lg border border-orange-100">
                                <h5 className="text-xs font-semibold text-orange-800 uppercase">Temperature (°C)</h5>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Warning</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        {...register("tempWarning")}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Critical</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        {...register("tempCritical")}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                            </div>

                            {/* Vibration Thresholds */}
                            <div className="space-y-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                <h5 className="text-xs font-semibold text-blue-800 uppercase">Vibration (mm/s)</h5>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Warning</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        {...register("vibWarning")}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Critical</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        {...register("vibCritical")}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                            </div>

                            {/* Power Thresholds */}
                            <div className="space-y-3 bg-purple-50/50 p-3 rounded-lg border border-purple-100">
                                <h5 className="text-xs font-semibold text-purple-800 uppercase">Power (kW)</h5>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Warning</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        {...register("powerWarning")}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Critical</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        {...register("powerCritical")}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-semibold border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {isCreating ? "Saving..." : "Add Machine"}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}