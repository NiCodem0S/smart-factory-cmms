import ReactDOM from "react-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { CreateMachineDto } from "../../types/machine";
import useCreateMachine from "../../hooks/useCreateMachine";

interface AddMachineModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function AddMachineModal({ isOpen, onClose, onSuccess }: AddMachineModalProps) {
    if (!isOpen) return null;

    const { execute, isLoading, error } = useCreateMachine();
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<CreateMachineDto>();

    const handleFormSubmit: SubmitHandler<CreateMachineDto> = async (dto) => {
        try {
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

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-semibold border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {isLoading ? "Saving..." : "Add Machine"}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}