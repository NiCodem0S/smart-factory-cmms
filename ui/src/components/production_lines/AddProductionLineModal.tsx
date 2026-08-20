import ReactDOM from "react-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { useEffect } from "react";
import { AlertCircle, Factory, Layers, Loader2, X } from "lucide-react";
import { useFactoryHalls } from "../../hooks/useFactoryHalls";
import useProductionLinesByHallsId from "../../hooks/useProductionLines";
import useCreateProductionLine from "../../hooks/useCreateProductionLine";
import { CreateProductionLineDto } from "../../types/production";

interface AddProductionLineModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    initialHallId?: string | null;
}

interface FormValues {
    name: string;
    status: string;
    factoryHallId: string;
    orderInHall?: number | null;
}

export default function AddProductionLineModal({
    isOpen,
    onClose,
    onSuccess,
    initialHallId
}: AddProductionLineModalProps) {
    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors }
    } = useForm<FormValues>({
        defaultValues: {
            name: "",
            status: "Running",
            factoryHallId: initialHallId || "",
            orderInHall: 1
        }
    });

    const selectedHallId = watch("factoryHallId");

    const { data: halls = [], isLoading: isLoadingHalls, error: hallsError } = useFactoryHalls();
    const { lines = [], isLoading: isLoadingLines } = useProductionLinesByHallsId(selectedHallId || null);
    const { execute, isLoading: isCreating, error: createError } = useCreateProductionLine();

    useEffect(() => {
        if (isOpen) {
            const hallId = initialHallId || (halls.length > 0 ? halls[0].id : "");
            reset({
                name: "",
                status: "Running",
                factoryHallId: hallId,
                orderInHall: 1
            });
        }
    }, [isOpen, initialHallId, halls, reset]);

    useEffect(() => {
        if (isOpen && lines && lines.length > 0) {
            const maxOrder = Math.max(...lines.map(l => l.orderInHall || 0), 0);
            setValue("orderInHall", maxOrder + 1);
        } else if (isOpen) {
            setValue("orderInHall", 1);
        }
    }, [isOpen, lines, setValue]);

    if (!isOpen) return null;

    const handleFormSubmit: SubmitHandler<FormValues> = async (formData) => {
        try {
            const dto: CreateProductionLineDto = {
                name: formData.name.trim(),
                status: formData.status,
                factoryHallId: formData.factoryHallId,
                orderInHall: formData.orderInHall ? Number(formData.orderInHall) : null
            };

            await execute(dto);
            reset();
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error(err);
        }
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Add Production Line</h2>
                            <p className="text-xs text-slate-500">Configure new manufacturing line and hall placement</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body / Form */}
                <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-5">
                    {createError && (
                        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2.5 font-medium">
                            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                            <span>{createError}</span>
                        </div>
                    )}

                    {hallsError && (
                        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2.5 font-medium">
                            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                            <span>{hallsError}</span>
                        </div>
                    )}

                    {/* SECTION 1: Line Identity */}
                    <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">1</span>
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Line Information</h3>
                        </div>

                        {/* Name Input */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                Production Line Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Chassis Frame Welding & Coating"
                                {...register("name", {
                                    required: "Production line name is required",
                                    maxLength: { value: 100, message: "Name cannot exceed 100 characters" }
                                })}
                                className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white transition-all ${errors.name ? "border-red-400 focus:ring-red-400" : "border-slate-200 focus:ring-blue-500 focus:border-blue-500"
                                    }`}
                            />
                            {errors.name && (
                                <span className="text-xs text-red-500 mt-1 block font-medium">
                                    {errors.name.message}
                                </span>
                            )}
                        </div>

                        {/* Status Select */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Initial Status</label>
                            <select
                                {...register("status", { required: true })}
                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                                <option value="Running">Running (Normal Operation)</option>
                                <option value="Warning">Warning (Operating with Alerts)</option>
                                <option value="Halted">Halted (Stopped / Standby)</option>
                                <option value="Maintenance">Maintenance (Under Service)</option>
                            </select>
                        </div>
                    </div>

                    {/* SECTION 2: Location & Sequence Assignment */}
                    <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">2</span>
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Hall Placement & Sequence</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Factory Hall */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                    <Factory className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Factory Hall</span> <span className="text-red-500">*</span>
                                </label>
                                <select
                                    {...register("factoryHallId", { required: "Factory Hall selection is required" })}
                                    className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white transition-all ${errors.factoryHallId ? "border-red-400 focus:ring-red-400" : "border-slate-200 focus:ring-blue-500 focus:border-blue-500"
                                        }`}
                                    disabled={isLoadingHalls}
                                >
                                    <option value="">-- Select Factory Hall --</option>
                                    {halls.map((hall) => (
                                        <option key={hall.id} value={hall.id}>
                                            {hall.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.factoryHallId && (
                                    <span className="text-xs text-red-500 mt-1 block font-medium">
                                        {errors.factoryHallId.message}
                                    </span>
                                )}
                            </div>

                            {/* Order in Hall */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Order Index in Hall (L#)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    {...register("orderInHall", {
                                        min: { value: 1, message: "Order index must be 1 or higher" },
                                        validate: (value) => {
                                            if (!value) return true;
                                            const num = Number(value);
                                            const conflict = lines.some((l) => l.orderInHall === num);
                                            return !conflict || `Line index L${num} is already used in this hall`;
                                        }
                                    })}
                                    className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white transition-all ${errors.orderInHall ? "border-red-400 focus:ring-red-400" : "border-slate-200 focus:ring-blue-500 focus:border-blue-500"
                                        }`}
                                    placeholder={isLoadingLines ? "Loading..." : "e.g. 1, 2, 3..."}
                                />
                                {errors.orderInHall && (
                                    <span className="text-xs text-red-500 mt-1 block font-medium">
                                        {errors.orderInHall.message}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    <span>Creating...</span>
                                </>
                            ) : (
                                <span>Create Line</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}