import ReactDOM from "react-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import {
    Check,
    Copy,
    Cpu,
    KeyRound,
    Lock,
    Radio,
    RefreshCw,
    ShieldAlert,
    Terminal,
} from "lucide-react";
import {
    CreateAlertThresholdsDto,
    CreateMachineDto,
    DeviceKeyResponseDto,
    MachineDetailDto,
    TelemetrySource,
    UpdateMachineDto,
} from "../../types/machine";
import useCreateMachine from "../../hooks/useCreateMachine";
import { useMachinesByProductionHallId } from "../../hooks/useProductionLines";
import { useEffect, useState } from "react";
import { useFactoryHalls } from "../../hooks/useFactoryHalls";
import useProductionLinesByHallsId from "../../hooks/useProductionLines";
import { AVAILABLE_ICONS } from "../common/MachineIcon";
import { apiClient } from "../../services/apiClient";
import { rotateMachineDeviceKey, updateMachine } from "../../services/machineService";
import { simulationError, simulationService } from "../../services/simulationService";

interface AddMachineModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    initialData?: MachineDetailDto | null;
}

interface FormValues extends Omit<CreateMachineDto, "alertThresholds" | "supportedMetrics"> {
    telemetrySource: TelemetrySource;
    externalDeviceId: string;
    expectedIntervalSeconds: number;
    offlineTimeoutSeconds: number;
    tempWarning: number;
    tempCritical: number;
    vibWarning: number;
    vibCritical: number;
    powerWarning: number | "";
    powerCritical: number | "";
}

interface CreatedDeviceSetup {
    machineId: string;
    machineName: string;
    deviceKey: string;
    deviceKeyPrefix: string;
}

const SENSOR_CHANNEL_OPTIONS = [
    { key: "Temperature", label: "Temperature (°C)" },
    { key: "Vibration", label: "Vibration (mm/s)" },
    { key: "PowerLoadKw", label: "Power Load (kW)" },
    { key: "ProductionCounter", label: "Production Counter" },
] as const;

const DEFAULT_SUPPORTED_METRICS: string[] = SENSOR_CHANNEL_OPTIONS.map(c => c.key);

const DEFAULT_FORM_VALUES: FormValues = {
    name: "",
    category: "",
    serialNumber: "",
    cycleTimeSeconds: 5.0,
    orderInLine: 0,
    normTemp: 60.0,
    baseVib: 1.0,
    normPower: 15.0,
    status: "Offline",
    factoryHallId: "",
    productionLineId: null,
    icon: "PrecisionManufacturing",
    telemetrySource: "Simulated",
    externalDeviceId: "",
    expectedIntervalSeconds: 5,
    offlineTimeoutSeconds: 30,
    tempWarning: 75.0,
    tempCritical: 90.0,
    vibWarning: 4.0,
    vibCritical: 6.0,
    powerWarning: "",
    powerCritical: "",
};

function parseSupportedMetrics(raw: string | null | undefined): string[] {
    if (!raw) return DEFAULT_SUPPORTED_METRICS;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter((v): v is string => typeof v === "string");
        }
    } catch {
        // Fallback to default channel list
    }
    return DEFAULT_SUPPORTED_METRICS;
}

function getIngestUrl(): string {
    const base = (apiClient.defaults.baseURL || "/api").replace(/\/$/, "");
    if (base.startsWith("http://") || base.startsWith("https://")) {
        return `${base}/telemetry/ingest`;
    }
    return `${window.location.origin}${base.startsWith("/") ? base : `/${base}`}/telemetry/ingest`;
}

function buildCurlExample(deviceKey: string): string {
    const url = getIngestUrl();
    return `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -H "X-Device-Key: ${deviceKey}" \\\n  -d '{"temperature": 62.4, "vibration": 1.3, "powerLoadKw": 14.8, "producedDelta": 1}'`;
}

export default function AddMachineModal({ isOpen, onClose, onSuccess, initialData }: AddMachineModalProps) {
    const isEditMode = Boolean(initialData);
    const [profileVersion, setProfileVersion] = useState<number | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [supportedMetrics, setSupportedMetrics] = useState<string[]>(DEFAULT_SUPPORTED_METRICS);
    const [createdDeviceSetup, setCreatedDeviceSetup] = useState<CreatedDeviceSetup | null>(null);
    const [rotatedKey, setRotatedKey] = useState<DeviceKeyResponseDto | null>(null);
    const [rotatingKey, setRotatingKey] = useState(false);
    const [copiedField, setCopiedField] = useState<"key" | "curl" | "url" | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors },
    } = useForm<FormValues>({
        defaultValues: DEFAULT_FORM_VALUES,
    });

    const telemetrySource = watch("telemetrySource") || "Simulated";
    const isRealDevice = telemetrySource === "RealDevice";

    useEffect(() => {
        if (!isOpen) return;
        setCreatedDeviceSetup(null);
        setRotatedKey(null);
        setCopiedField(null);

        if (initialData) {
            let staticProps: Record<string, number> = {};
            try {
                if (initialData.staticProperties) {
                    staticProps = JSON.parse(initialData.staticProperties);
                }
            } catch (e) {
                console.error(e);
            }

            const tempThresh = initialData.alertThresholds?.find(t => t.metricType === "Temperature");
            const vibThresh = initialData.alertThresholds?.find(t => t.metricType === "Vibration");
            const powerThresh = initialData.alertThresholds?.find(
                t => t.metricType === "PowerLoadKw" || t.metricType === "Power"
            );

            setSupportedMetrics(parseSupportedMetrics(initialData.supportedMetrics));

            reset({
                name: initialData.name,
                category: initialData.category,
                serialNumber: initialData.serialNumber,
                status: initialData.status,
                cycleTimeSeconds: initialData.cycleTimeSeconds,
                orderInLine: initialData.orderInLine,
                icon: initialData.icon || "PrecisionManufacturing",
                factoryHallId: initialData.factoryHallId || "",
                productionLineId: initialData.productionLineId || null,
                telemetrySource: initialData.telemetrySource || "Simulated",
                externalDeviceId: initialData.externalDeviceId || "",
                expectedIntervalSeconds: initialData.expectedIntervalSeconds || 5,
                offlineTimeoutSeconds: initialData.offlineTimeoutSeconds || 30,
                normTemp: staticProps.NormTemp ?? DEFAULT_FORM_VALUES.normTemp,
                baseVib: staticProps.BaseVib ?? DEFAULT_FORM_VALUES.baseVib,
                normPower: staticProps.NormPower ?? DEFAULT_FORM_VALUES.normPower,
                tempWarning: tempThresh ? tempThresh.warningValue : DEFAULT_FORM_VALUES.tempWarning,
                tempCritical: tempThresh ? tempThresh.criticalValue : DEFAULT_FORM_VALUES.tempCritical,
                vibWarning: vibThresh ? vibThresh.warningValue : DEFAULT_FORM_VALUES.vibWarning,
                vibCritical: vibThresh ? vibThresh.criticalValue : DEFAULT_FORM_VALUES.vibCritical,
                powerWarning: powerThresh ? powerThresh.warningValue : "",
                powerCritical: powerThresh ? powerThresh.criticalValue : "",
            });
        } else {
            setSupportedMetrics(DEFAULT_SUPPORTED_METRICS);
            reset(DEFAULT_FORM_VALUES);
        }
    }, [isOpen, initialData, reset]);

    useEffect(() => {
        if (!isOpen) return;
        let active = true;
        setSaveError(null);
        setProfileVersion(null);
        if (initialData && initialData.telemetrySource !== "RealDevice") {
            simulationService
                .profile(initialData.id)
                .then(profile => {
                    if (!active) return;
                    setValue("normTemp", profile.normalTemperature);
                    setValue("baseVib", profile.baseVibration);
                    setValue("normPower", profile.normalPowerKw);
                    setProfileVersion(profile.version);
                })
                .catch(error => {
                    if (active) setSaveError(simulationError(error));
                });
        }
        return () => {
            active = false;
        };
    }, [isOpen, initialData, setValue]);

    const selectedHallId = watch("factoryHallId");
    const selectedLineId = watch("productionLineId");

    const selectedIconName = watch("icon") || "PrecisionManufacturing";
    const selectedIconObj = AVAILABLE_ICONS.find(i => i.name === selectedIconName) || AVAILABLE_ICONS[0];

    const { execute, isLoading: isCreating, error } = useCreateMachine();
    const { data: halls = [], isLoading: isLoadingHalls, error: hallsError } = useFactoryHalls(isOpen);
    const { lines = [], isLoading: isLoadingLines, error: linesError } = useProductionLinesByHallsId(selectedHallId, {
        enabled: isOpen,
        pollIntervalMs: 0,
    });
    const { machines: lineMachines = [] } = useMachinesByProductionHallId(selectedLineId || "", {
        enabled: isOpen,
        pollIntervalMs: 0,
    });

    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

    const copyText = async (text: string, field: "key" | "curl" | "url") => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            window.setTimeout(() => setCopiedField(prev => (prev === field ? null : prev)), 2200);
        } catch {
            // Clipboard fallback ignored silently
        }
    };

    const toggleMetric = (metricKey: string) => {
        setSupportedMetrics(prev => {
            if (prev.includes(metricKey)) {
                return prev.length > 1 ? prev.filter(m => m !== metricKey) : prev;
            }
            return [...prev, metricKey];
        });
    };

    const handleRotateKeyInEdit = async () => {
        if (!initialData) return;
        setRotatingKey(true);
        setSaveError(null);
        try {
            const response = await rotateMachineDeviceKey(initialData.id);
            setRotatedKey(response);
            onSuccess?.();
        } catch (err) {
            setSaveError(simulationError(err));
        } finally {
            setRotatingKey(false);
        }
    };

    const handleCloseModal = () => {
        setCreatedDeviceSetup(null);
        setRotatedKey(null);
        onClose();
    };

    const handleFormSubmit: SubmitHandler<FormValues> = async formData => {
        setSaving(true);
        setSaveError(null);
        try {
            const alertThresholdsDtos: CreateAlertThresholdsDto[] = [
                {
                    metricType: "Temperature",
                    warningValue: Number(formData.tempWarning),
                    criticalValue: Number(formData.tempCritical),
                },
                {
                    metricType: "Vibration",
                    warningValue: Number(formData.vibWarning),
                    criticalValue: Number(formData.vibCritical),
                },
            ];

            const pWarn = formData.powerWarning === "" ? NaN : Number(formData.powerWarning);
            const pCrit = formData.powerCritical === "" ? NaN : Number(formData.powerCritical);
            if (Number.isFinite(pWarn) && Number.isFinite(pCrit) && pCrit > 0) {
                alertThresholdsDtos.push({
                    metricType: "PowerLoadKw",
                    warningValue: pWarn,
                    criticalValue: pCrit,
                });
            }

            if (isEditMode && initialData) {
                const updateDto: UpdateMachineDto = {
                    simulationProfileVersion: isRealDevice ? undefined : profileVersion ?? undefined,
                    name: formData.name.trim(),
                    category: formData.category,
                    serialNumber: formData.serialNumber || null,
                    cycleTimeSeconds: Number(formData.cycleTimeSeconds),
                    orderInLine: Number(formData.orderInLine),
                    icon: formData.icon,
                    factoryHallId: formData.factoryHallId,
                    productionLineId: formData.productionLineId || null,
                    normTemp: Number(formData.normTemp),
                    baseVib: Number(formData.baseVib),
                    normPower: Number(formData.normPower),
                    externalDeviceId: isRealDevice ? formData.externalDeviceId.trim() || null : undefined,
                    expectedIntervalSeconds: isRealDevice ? Number(formData.expectedIntervalSeconds) : undefined,
                    offlineTimeoutSeconds: isRealDevice ? Number(formData.offlineTimeoutSeconds) : undefined,
                    supportedMetrics: isRealDevice ? supportedMetrics : undefined,
                    alertThresholds: alertThresholdsDtos,
                };
                await updateMachine(initialData.id, updateDto);
                reset();
                onSuccess?.();
                onClose();
            } else {
                const createDto: CreateMachineDto = {
                    name: formData.name.trim(),
                    category: formData.category,
                    serialNumber: formData.serialNumber,
                    status: "Offline",
                    cycleTimeSeconds: Number(formData.cycleTimeSeconds),
                    orderInLine: Number(formData.orderInLine),
                    icon: formData.icon,
                    factoryHallId: formData.factoryHallId,
                    productionLineId: formData.productionLineId || null,
                    normTemp: Number(formData.normTemp),
                    baseVib: Number(formData.baseVib),
                    normPower: Number(formData.normPower),
                    telemetrySource: formData.telemetrySource,
                    externalDeviceId: formData.telemetrySource === "RealDevice"
                        ? formData.externalDeviceId.trim() || null
                        : null,
                    expectedIntervalSeconds: formData.telemetrySource === "RealDevice"
                        ? Number(formData.expectedIntervalSeconds)
                        : 5,
                    offlineTimeoutSeconds: formData.telemetrySource === "RealDevice"
                        ? Number(formData.offlineTimeoutSeconds)
                        : 30,
                    supportedMetrics: formData.telemetrySource === "RealDevice" ? supportedMetrics : null,
                    alertThresholds: alertThresholdsDtos,
                };
                const created = await execute(createDto);
                onSuccess?.();

                if (formData.telemetrySource === "RealDevice" && created.deviceKey) {
                    setCreatedDeviceSetup({
                        machineId: created.id,
                        machineName: created.name,
                        deviceKey: created.deviceKey,
                        deviceKeyPrefix: created.deviceKeyPrefix || created.deviceKey.slice(0, 12),
                    });
                    reset();
                } else {
                    reset();
                    onClose();
                }
            }
        } catch (err) {
            setSaveError(simulationError(err));
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const ingestUrl = getIngestUrl();

    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-3xl space-y-5 max-h-[90vh] overflow-y-auto">
                {/* Post-create IoT Device Connection Setup Screen */}
                {createdDeviceSetup ? (
                    <div className="space-y-5">
                        <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                                    <Radio className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Device Connection Setup</h2>
                                    <p className="text-xs text-slate-500">
                                        <strong>{createdDeviceSetup.machineName}</strong> is registered and ready to receive live telemetry
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs">
                            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-bold">Save this API key now.</span> For security, only a SHA-256 hash is stored on the server — this raw key will not be shown again (you can rotate it later in Machine Details).
                            </div>
                        </div>

                        {/* API Key & Endpoint */}
                        <div className="grid grid-cols-1 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                        Device API Key (Header: X-Device-Key)
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => void copyText(createdDeviceSetup.deviceKey, "key")}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                    >
                                        {copiedField === "key" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>{copiedField === "key" ? "Copied" : "Copy Key"}</span>
                                    </button>
                                </div>
                                <code className="block w-full px-3 py-2.5 bg-slate-900 text-emerald-400 font-mono text-xs rounded-lg break-all select-all">
                                    {createdDeviceSetup.deviceKey}
                                </code>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div>
                                    <span className="block text-[11px] font-semibold text-slate-500 mb-1">Ingest Endpoint</span>
                                    <div className="flex items-center gap-1.5">
                                        <code className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-md font-mono text-[11px] text-slate-700 truncate">
                                            POST {ingestUrl}
                                        </code>
                                        <button
                                            type="button"
                                            onClick={() => void copyText(ingestUrl, "url")}
                                            className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                                            title="Copy endpoint URL"
                                        >
                                            {copiedField === "url" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <span className="block text-[11px] font-semibold text-slate-500 mb-1">Machine ID</span>
                                    <code className="block px-2.5 py-1.5 bg-white border border-slate-200 rounded-md font-mono text-[11px] text-slate-700 truncate">
                                        {createdDeviceSetup.machineId}
                                    </code>
                                </div>
                            </div>
                        </div>

                        {/* Copyable cURL Snippet */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                                    Quick Test Command (cURL)
                                </span>
                                <button
                                    type="button"
                                    onClick={() => void copyText(buildCurlExample(createdDeviceSetup.deviceKey), "curl")}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                >
                                    {copiedField === "curl" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span>{copiedField === "curl" ? "Copied" : "Copy cURL"}</span>
                                </button>
                            </div>
                            <pre className="p-3.5 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed">
                                {buildCurlExample(createdDeviceSetup.deviceKey)}
                            </pre>
                            <p className="text-[11px] text-slate-500">
                                Supports single readings or mini-batches via <code>{`{"samples": [...]}`}</code> (up to 100 samples/request). Data flows atomically to Redis, SignalR, and batched SQL history via Redis Streams.
                            </p>
                        </div>

                        <div className="flex justify-end pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Modal Header */}
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">
                                    {isEditMode ? "Edit Machine" : "Add New Machine"}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Configure telemetry source, machine identity, operating parameters, and alert thresholds
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        {(saveError || error) && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                                {saveError || error}
                            </div>
                        )}

                        {hallsError && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                                {hallsError}
                            </div>
                        )}

                        {linesError && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                                {linesError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
                            {/* Telemetry Source Selector */}
                            {isEditMode ? (
                                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                                    <div className="flex items-center gap-2.5">
                                        {isRealDevice ? (
                                            <Radio className="w-4 h-4 text-emerald-600" />
                                        ) : (
                                            <Cpu className="w-4 h-4 text-blue-600" />
                                        )}
                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            Telemetry Source:
                                        </span>
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                isRealDevice
                                                    ? "bg-emerald-100 text-emerald-800"
                                                    : "bg-blue-100 text-blue-800"
                                            }`}
                                        >
                                            {isRealDevice ? "Real Device (IoT / PLC)" : "Simulated Machine"}
                                        </span>
                                    </div>
                                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                        <Lock className="w-3 h-3" />
                                        Locked after creation
                                    </span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        Telemetry Source
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setValue("telemetrySource", "Simulated")}
                                            className={`text-left p-3.5 rounded-xl border-2 transition-all flex items-start gap-3 ${
                                                !isRealDevice
                                                    ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-100"
                                                    : "border-slate-200 bg-white hover:border-slate-300"
                                            }`}
                                        >
                                            <div
                                                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                                    !isRealDevice
                                                        ? "bg-blue-600 text-white"
                                                        : "bg-slate-100 text-slate-500"
                                                }`}
                                            >
                                                <Cpu className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">Simulated Machine</div>
                                                <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                                                    Built-in physics engine with wear, cycle counter, and fault scenarios.
                                                </p>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setValue("telemetrySource", "RealDevice")}
                                            className={`text-left p-3.5 rounded-xl border-2 transition-all flex items-start gap-3 ${
                                                isRealDevice
                                                    ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-100"
                                                    : "border-slate-200 bg-white hover:border-slate-300"
                                            }`}
                                        >
                                            <div
                                                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                                    isRealDevice
                                                        ? "bg-emerald-600 text-white"
                                                        : "bg-slate-100 text-slate-500"
                                                }`}
                                            >
                                                <Radio className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">Real Device (IoT / PLC)</div>
                                                <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                                                    Connect physical hardware via API Key, HTTP ingest, and Redis Streams.
                                                </p>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* SECTION 1: Machine Identity & Location */}
                            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/80 space-y-4">
                                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                                        1
                                    </span>
                                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        Identity & Location Assignment
                                    </h3>
                                </div>

                                {/* Icon & Name Row */}
                                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Machine Icon</label>
                                        <div className="flex items-center gap-2">
                                            <div className="w-10 h-10 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-blue-600 shrink-0 shadow-xs">
                                                {selectedIconObj.component}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsIconPickerOpen(true)}
                                                className="px-3 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                                            >
                                                Choose Icon
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 w-full">
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Machine Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. CNC Milling Unit #4"
                                            {...register("name", {
                                                required: "Machine name is required",
                                                maxLength: { value: 255, message: "Name cannot exceed 255 characters" },
                                            })}
                                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 bg-white ${
                                                errors.name
                                                    ? "border-red-500 focus:ring-red-500"
                                                    : "border-slate-300 focus:ring-blue-500"
                                            }`}
                                        />
                                        {errors.name && (
                                            <span className="text-xs text-red-500 mt-1 block">{errors.name.message}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Category, Status, Serial Number */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Milling"
                                            {...register("category", {
                                                required: "Category is required",
                                                maxLength: { value: 127, message: "Category cannot exceed 127 characters" },
                                            })}
                                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 bg-white ${
                                                errors.category
                                                    ? "border-red-500 focus:ring-red-500"
                                                    : "border-slate-300 focus:ring-blue-500"
                                            }`}
                                        />
                                        {errors.category && (
                                            <span className="text-xs text-red-500 mt-1 block">{errors.category.message}</span>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Machine status</label>
                                        <select
                                            disabled
                                            {...register("status", { required: true })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        >
                                            <option value="Running">Running</option>
                                            <option value="Warning">Warning</option>
                                            <option value="Error">Error</option>
                                            <option value="Maintenance">Maintenance</option>
                                            <option value="Offline">Offline</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Serial Number</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. SN-99482"
                                            {...register("serialNumber", {
                                                required: "Serial number is required",
                                                maxLength: { value: 127, message: "Serial number cannot exceed 127 characters" },
                                            })}
                                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 bg-white ${
                                                errors.serialNumber
                                                    ? "border-red-500 focus:ring-red-500"
                                                    : "border-slate-300 focus:ring-blue-500"
                                            }`}
                                        />
                                        {errors.serialNumber && (
                                            <span className="text-xs text-red-500 mt-1 block">{errors.serialNumber.message}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Factory Hall & Production Line */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Factory Hall</label>
                                        <select
                                            {...register("factoryHallId", { required: "Factory Hall selection is required" })}
                                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                                                errors.factoryHallId
                                                    ? "border-red-500 focus:ring-red-500"
                                                    : "border-slate-300 focus:ring-blue-500"
                                            } bg-white`}
                                            disabled={isLoadingHalls}
                                        >
                                            <option value="">-- Select Factory Hall --</option>
                                            {halls.map(hall => (
                                                <option key={hall.id} value={hall.id}>
                                                    {hall.name}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.factoryHallId && (
                                            <span className="text-xs text-red-500 mt-1 block">{errors.factoryHallId.message}</span>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                                            Production Line <span className="font-normal text-slate-400">(Optional / Utility)</span>
                                        </label>
                                        <select
                                            {...register("productionLineId")}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                                            disabled={!selectedHallId || isLoadingLines}
                                        >
                                            <option value="">-- None (Standalone Utility Machine) --</option>
                                            {lines.map(line => (
                                                <option key={line.id} value={line.id}>
                                                    {line.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: Mode-Specific Operating / IoT Configuration */}
                            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/80 space-y-4">
                                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                                    <span
                                        className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                                            isRealDevice
                                                ? "bg-emerald-100 text-emerald-700"
                                                : "bg-blue-100 text-blue-700"
                                        }`}
                                    >
                                        2
                                    </span>
                                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        {isRealDevice ? "IoT Device Telemetry Configuration" : "Operating & Simulation Baseline"}
                                    </h3>
                                </div>

                                {/* Cycle Time & Order in Line (shared) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Cycle Time (seconds)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            {...register("cycleTimeSeconds", { required: true, min: 0.1 })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Order Index in Line</label>
                                        <input
                                            type="number"
                                            {...register("orderInLine", {
                                                required: true,
                                                min: 0,
                                                validate: value => {
                                                    if (!selectedLineId) return true;
                                                    const machine = lineMachines.find(m => m.orderInLine === Number(value));
                                                    if (machine && machine.id === initialData?.id) return true;
                                                    if (machine?.orderInLine == value) return true;
                                                    return !machine || `Index ${value} is already used by another machine on this line`;
                                                },
                                            })}
                                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 bg-white ${
                                                errors.orderInLine
                                                    ? "border-red-500 focus:ring-red-500"
                                                    : "border-slate-300 focus:ring-blue-500"
                                            }`}
                                        />
                                        {errors.orderInLine && (
                                            <span className="text-xs text-red-500 mt-1 block">{errors.orderInLine.message}</span>
                                        )}
                                    </div>
                                </div>

                                {!isRealDevice ? (
                                    /* Simulated Nominal Parameters */
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                                                Nominal temperature (°C)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                {...register("normTemp", { required: !isRealDevice })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                                                Nominal vibration (mm/s)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                {...register("baseVib", { required: !isRealDevice })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                                                Nominal power (kW)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                {...register("normPower", { required: !isRealDevice })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    /* Real Device IoT Settings */
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                                    External Device ID <span className="font-normal text-slate-400">(Optional)</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. plc-hall1-cnc04"
                                                    {...register("externalDeviceId", {
                                                        maxLength: { value: 128, message: "Max 128 characters" },
                                                    })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                                    Expected Interval (s)
                                                </label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={86400}
                                                    {...register("expectedIntervalSeconds", {
                                                        required: isRealDevice,
                                                        min: { value: 1, message: "Min 1s" },
                                                    })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                                    Offline Timeout (s)
                                                </label>
                                                <input
                                                    type="number"
                                                    min={5}
                                                    max={86400}
                                                    {...register("offlineTimeoutSeconds", {
                                                        required: isRealDevice,
                                                        min: { value: 5, message: "Min 5s" },
                                                    })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-2">
                                                Supported Sensor Channels
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {SENSOR_CHANNEL_OPTIONS.map(channel => {
                                                    const checked = supportedMetrics.includes(channel.key);
                                                    return (
                                                        <button
                                                            key={channel.key}
                                                            type="button"
                                                            onClick={() => toggleMetric(channel.key)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                                                                checked
                                                                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                                                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                                                            }`}
                                                        >
                                                            <span
                                                                className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                                                                    checked
                                                                        ? "bg-emerald-600 text-white"
                                                                        : "border border-slate-300 bg-white"
                                                                }`}
                                                            >
                                                                {checked ? "✓" : ""}
                                                            </span>
                                                            <span>{channel.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {isEditMode && initialData ? (
                                            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <KeyRound className="w-4 h-4 text-slate-500" />
                                                        <span className="font-semibold text-slate-700">Device API Key:</span>
                                                        <code className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                                                            {rotatedKey?.deviceKeyPrefix || initialData.deviceKeyPrefix || "Not issued"}…
                                                        </code>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        disabled={rotatingKey}
                                                        onClick={() => void handleRotateKeyInEdit()}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors disabled:opacity-50"
                                                    >
                                                        <RefreshCw className={`w-3.5 h-3.5 ${rotatingKey ? "animate-spin" : ""}`} />
                                                        <span>{rotatingKey ? "Rotating…" : "Regenerate API Key"}</span>
                                                    </button>
                                                </div>
                                                {rotatedKey && (
                                                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                                                        <div className="flex items-center justify-between text-[11px] text-amber-700 font-semibold">
                                                            <span>New one-time key (previous key immediately revoked):</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => void copyText(rotatedKey.deviceKey, "key")}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 text-white font-semibold"
                                                            >
                                                                {copiedField === "key" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                                <span>{copiedField === "key" ? "Copied" : "Copy"}</span>
                                                            </button>
                                                        </div>
                                                        <code className="block w-full px-2.5 py-1.5 bg-slate-900 text-emerald-400 rounded font-mono text-[11px] break-all select-all">
                                                            {rotatedKey.deviceKey}
                                                        </code>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                                                <KeyRound className="w-4 h-4 text-emerald-600 shrink-0" />
                                                <span>
                                                    A unique <strong>Device API Key</strong> and ready-to-use <code>curl</code> snippet will be generated right after saving.
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {isEditMode && !isRealDevice && (
                                <p className="text-xs text-slate-500">
                                    Nominal values update the active simulation profile and Specific Properties together. Additional parameters are available in Machine Simulation.
                                </p>
                            )}

                            {/* SECTION 3: Alert Thresholds */}
                            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                                        3
                                    </span>
                                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Alert Thresholds</h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* Temperature Thresholds */}
                                    <div className="space-y-2 bg-orange-50/60 p-3 rounded-lg border border-orange-100">
                                        <h5 className="text-xs font-semibold text-orange-800 uppercase">Temperature (°C)</h5>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Warning</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    {...register("tempWarning")}
                                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Critical</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    {...register("tempCritical")}
                                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Vibration Thresholds */}
                                    <div className="space-y-2 bg-blue-50/60 p-3 rounded-lg border border-blue-100">
                                        <h5 className="text-xs font-semibold text-blue-800 uppercase">Vibration (mm/s)</h5>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Warning</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    {...register("vibWarning")}
                                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Critical</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    {...register("vibCritical")}
                                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Optional Power Thresholds */}
                                    <div className="space-y-2 bg-emerald-50/60 p-3 rounded-lg border border-emerald-100">
                                        <h5 className="text-xs font-semibold text-emerald-800 uppercase">
                                            Power (kW) <span className="font-normal text-[10px] text-slate-400">Opt.</span>
                                        </h5>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Warning</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    placeholder="—"
                                                    {...register("powerWarning")}
                                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-medium text-slate-600 mb-1">Critical</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    placeholder="—"
                                                    {...register("powerCritical")}
                                                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-5 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating || saving || (isEditMode && !isRealDevice && profileVersion === null)}
                                    className={`px-6 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 shadow-xs ${
                                        isRealDevice
                                            ? "bg-emerald-600 hover:bg-emerald-700"
                                            : "bg-blue-600 hover:bg-blue-700"
                                    }`}
                                >
                                    {isCreating || saving
                                        ? "Saving…"
                                        : isEditMode && !isRealDevice && profileVersion === null
                                          ? "Loading profile…"
                                          : !isEditMode && isRealDevice
                                            ? "Create & Generate Key"
                                            : "Save"}
                                </button>
                            </div>
                        </form>
                    </>
                )}
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

                        <div className="grid grid-cols-6 gap-3 p-1">
                            {AVAILABLE_ICONS.map(iconItem => {
                                const isSelected = selectedIconName === iconItem.name;
                                return (
                                    <button
                                        key={iconItem.name}
                                        type="button"
                                        onClick={() => {
                                            setValue("icon", iconItem.name);
                                            setIsIconPickerOpen(false);
                                        }}
                                        className={`w-12 h-12 flex items-center justify-center rounded-xl border transition-all ${
                                            isSelected
                                                ? "border-blue-600 bg-blue-50 text-blue-600 ring-2 ring-blue-200 shadow-sm"
                                                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600"
                                        }`}
                                    >
                                        <div className="flex items-center justify-center">{iconItem.component}</div>
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
