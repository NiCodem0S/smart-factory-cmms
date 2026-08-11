import ReactDOM from "react-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { AlertThresholds, AlertThresholdsDto, CreateAlertThresholdsDto, CreateMachineDto } from "../../types/machine";
import { FactoryHallDto } from "../../types/factory";
import { ProductionLineDto } from "../../types/production"
import useCreateMachine from "../../hooks/useCreateMachine";
import { useEffect, useState } from "react";

import TireRepairIcon from '@mui/icons-material/TireRepair';
import WindPowerIcon from '@mui/icons-material/WindPower';
import CompressIcon from '@mui/icons-material/Compress';
import SmartScreenIcon from '@mui/icons-material/SmartScreen';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent';
import ScaleIcon from '@mui/icons-material/Scale';
import RvHookupIcon from '@mui/icons-material/RvHookup';
import RoomPreferencesIcon from '@mui/icons-material/RoomPreferences';
import RepartitionIcon from '@mui/icons-material/Repartition';
import PowerInputIcon from '@mui/icons-material/PowerInput';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import MicrowaveIcon from '@mui/icons-material/Microwave';
import MemoryIcon from '@mui/icons-material/Memory';
import FireplaceIcon from '@mui/icons-material/Fireplace';
import FactoryIcon from '@mui/icons-material/Factory';
import ElectricCarIcon from '@mui/icons-material/ElectricCar';
import CableIcon from '@mui/icons-material/Cable';
import BrunchDiningIcon from '@mui/icons-material/BrunchDining';
import BarcodeReaderIcon from '@mui/icons-material/BarcodeReader';
import RouterIcon from '@mui/icons-material/Router';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ModelTrainingIcon from '@mui/icons-material/ModelTraining';

import AirIcon from '@mui/icons-material/Air';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ShowerIcon from '@mui/icons-material/Shower';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import TuneIcon from '@mui/icons-material/Tune';
import { useFactoryHalls } from "../../hooks/useFactoryHalls";

const TwoCogsIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <g transform="translate(-1, -1) scale(0.6)">
            <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
        </g>
        <g transform="translate(8.5, 8.5) scale(0.6)">
            <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
        </g>
    </svg>
);

export const AVAILABLE_ICONS = [
    { name: 'PrecisionManufacturing', component: <PrecisionManufacturingIcon fontSize="medium" /> },
    { name: 'Factory', component: <FactoryIcon fontSize="medium" /> },
    { name: 'PowerInput', component: <PowerInputIcon fontSize="medium" /> },
    { name: 'Cable', component: <CableIcon fontSize="medium" /> },
    { name: 'Memory', component: <MemoryIcon fontSize="medium" /> },
    { name: 'Router', component: <RouterIcon fontSize="medium" /> },
    { name: 'ElectricCar', component: <ElectricCarIcon fontSize="medium" /> },
    { name: 'Compress', component: <CompressIcon fontSize="medium" /> },
    { name: 'SettingsInputComponent', component: <SettingsInputComponentIcon fontSize="medium" /> },
    { name: 'SmartScreen', component: <SmartScreenIcon fontSize="medium" /> },
    { name: 'RoomPreferences', component: <RoomPreferencesIcon fontSize="medium" /> },
    { name: 'Scale', component: <ScaleIcon fontSize="medium" /> },
    { name: 'BarcodeReader', component: <BarcodeReaderIcon fontSize="medium" /> },
    { name: 'WindPower', component: <WindPowerIcon fontSize="medium" /> },
    { name: 'TireRepair', component: <TireRepairIcon fontSize="medium" /> },
    { name: 'RvHookup', component: <RvHookupIcon fontSize="medium" /> },
    { name: 'Fireplace', component: <FireplaceIcon fontSize="medium" /> },
    { name: 'Repartition', component: <RepartitionIcon fontSize="medium" /> },
    { name: 'SettingsEthernet', component: <SettingsEthernetIcon fontSize="medium" /> },
    { name: 'Microwave', component: <MicrowaveIcon fontSize="medium" /> },
    { name: 'BrunchDining', component: <BrunchDiningIcon fontSize="medium" /> },
    { name: 'Unarchive', component: <UnarchiveIcon fontSize="medium" /> },
    { name: 'ModelTraining', component: <ModelTrainingIcon fontSize="medium" /> },
    { name: 'MoreHoriz', component: <MoreHorizIcon fontSize="medium" /> },
    { name: 'fa-cogs', component: <TwoCogsIcon className="w-6 h-6" /> },
    { name: 'Air', component: <AirIcon fontSize="medium" /> },
    { name: 'FilterAlt', component: <FilterAltIcon fontSize="medium" /> },
    { name: 'Shower', component: <ShowerIcon fontSize="medium" /> },
    { name: 'ViewQuilt', component: <ViewQuiltIcon fontSize="medium" /> },
    { name: 'Tune', component: <TuneIcon fontSize="medium" /> },
];

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
}

export default function AddMachineModal({ isOpen, onClose, onSuccess }: AddMachineModalProps) {
    if (!isOpen) return null;

    const { execute, isLoading: isCreating, error } = useCreateMachine();

    const [lines, setLines] = useState<ProductionLineListDto[]>([]);
    const [isLoadingLines, setIsLoadingLines] = useState(false);

    // Icon Picker Modal state
    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

    const { data: halls = [], isLoading: isLoadingHalls, error: hallsError } = useFactoryHalls();

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
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
            icon: "PrecisionManufacturing",
            tempWarning: 75.0,
            tempCritical: 90.0,
            vibWarning: 4.0,
            vibCritical: 6.0
        }
    });

    const selectedHallId = watch("factoryHallId");
    const selectedIconName = watch("icon") || "PrecisionManufacturing";
    const selectedIconObj = AVAILABLE_ICONS.find(i => i.name === selectedIconName) || AVAILABLE_ICONS[0];

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

            const alertThresholdsDtos: CreateAlertThresholdsDto[] = [
                { metricType: "Temperature", warningValue: Number(formData.tempWarning), criticalValue: Number(formData.tempCritical) },
                { metricType: "Vibration", warningValue: Number(formData.vibWarning), criticalValue: Number(formData.vibCritical) }
            ]

            const dto: CreateMachineDto = {
                ...formData,
                productionLineId: formData.productionLineId || null,
                alertThresholds: alertThresholdsDtos
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
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
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

                {hallsError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                        {hallsError}
                    </div>
                )}

                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
                    {/* Machine Icon Selector Button */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Machine Icon</label>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl border border-slate-300 bg-slate-50 flex items-center justify-center text-blue-600 shrink-0 shadow-xs">
                                {selectedIconObj.component}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsIconPickerOpen(true)}
                                className="px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors shadow-xs"
                            >
                                Choose Icon
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Name</label>
                        <input
                            type="text"
                            {...register("name", {
                                required: "Machine name is required",
                                maxLength: { value: 255, message: "Name cannot exceed 255 characters" }
                            })}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.name ? "border-red-500 focus:ring-red-500" : "border-slate-300 focus:ring-blue-500"}`}
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
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.category ? "border-red-500 focus:ring-red-500" : "border-slate-300 focus:ring-blue-500"}`}
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
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.serialNumber ? "border-red-500 focus:ring-red-500" : "border-slate-300 focus:ring-blue-500"}`}
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
                            {...register("status", { required: true })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="Running">Running</option>
                            <option value="Error">Error</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Offline">Offline</option>
                        </select>
                    </div>

                    {/* Step 1: Select Factory Hall */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Factory Hall</label>
                        <select
                            {...register("factoryHallId", { required: "Factory Hall selection is required" })}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.factoryHallId ? "border-red-500 focus:ring-red-500" : "border-slate-300 focus:ring-blue-500"} bg-white`}
                            disabled={isLoadingHalls}
                        >
                            <option value="">-- Select Factory Hall --</option>
                            {halls.map(hall => (
                                <option key={hall.id} value={hall.id}>
                                    {hall.name} ({hall.code})
                                </option>
                            ))}
                        </select>
                        {errors.factoryHallId && (
                            <span className="text-xs text-red-500 mt-1 block">
                                {errors.factoryHallId.message}
                            </span>
                        )}
                    </div>

                    {/* Step 2: Select Production Line (Filtered by selected Factory Hall) */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Production Line <span className="font-normal text-slate-400">(Optional / Utility)</span>
                        </label>
                        <select
                            {...register("productionLineId")}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                            disabled={!selectedHallId || isLoadingLines}
                        >
                            <option value="">-- None (Utility Machine) --</option>
                            {lines.map(line => (
                                <option key={line.id} value={line.id}>
                                    {line.name} ({line.code})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Cycle Time (sec)</label>
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

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Norm Temp (°C)</label>
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
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Norm Power (kW)</label>
                            <input
                                type="number"
                                step="0.1"
                                {...register("normPower", { required: true })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Alert Thresholds Section */}
                    <div className="pt-4 mt-4 border-t border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-700 mb-4">Alert Thresholds</h4>

                        <div className="grid grid-cols-2 gap-6">
                            {/* Temperature Thresholds */}
                            <div className="space-y-3 bg-orange-50/50 p-3 rounded-lg border border-orange-100">
                                <h5 className="text-xs font-semibold text-orange-800 uppercase">Temperature (°C)</h5>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Warning</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        {...register("tempWarning")}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Critical</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        {...register("tempCritical")}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
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
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Critical</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        {...register("vibCritical")}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {isCreating ? "Saving..." : "Add Machine"}
                        </button>
                    </div>
                </form>
            </div>

            {/* Sub-Modal / Popover for Icon Selection */}
            {isIconPickerOpen && (
                <div className="fixed inset-0 bg-black/40 z-60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-lg space-y-4 max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Select Machine Icon</h3>
                                <p className="text-xs text-slate-500">Pick an icon matching the machine's industrial function</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsIconPickerOpen(false)}
                                className="text-slate-400 hover:text-slate-600 font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Grid of Available Icons (Pure Icons) */}
                        <div className="grid grid-cols-6 gap-3 p-1">
                            {AVAILABLE_ICONS.map((iconItem) => {
                                const isSelected = selectedIconName === iconItem.name;
                                return (
                                    <button
                                        key={iconItem.name}
                                        type="button"
                                        onClick={() => {
                                            setValue("icon", iconItem.name);
                                            setIsIconPickerOpen(false);
                                        }}
                                        className={`w-12 h-12 flex items-center justify-center rounded-xl border transition-all ${isSelected
                                            ? 'border-blue-600 bg-blue-50 text-blue-600 ring-2 ring-blue-200 shadow-sm'
                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
                                            }`}
                                    >
                                        <div className="flex items-center justify-center">
                                            {iconItem.component}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex justify-end pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsIconPickerOpen(false)}
                                className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}