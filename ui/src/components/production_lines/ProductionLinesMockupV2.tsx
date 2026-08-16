import { useState, useEffect } from 'react';
import { Play, Square, Settings, Plus } from 'lucide-react';

import TireRepairIcon from '@mui/icons-material/TireRepair';
import WindPowerIcon from '@mui/icons-material/WindPower';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
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

interface MachineItem {
  id: number;
  name: string;
  icon: React.ReactNode;
  status: 'running' | 'warning' | 'error' | 'offline';
  cycleTime: number; // in seconds
}

interface LineItem {
  id: number;
  lineCode: string;
  name: string;
  uptime: string;
  status: 'Running' | 'Warning' | 'Halted';
  throughput: string;
  scrapRate: string;
  total24h: string;
  machines: MachineItem[];
}

const productionLinesV2: LineItem[] = [
  {
    id: 1,
    lineCode: "LN-8834",
    name: "Line Alpha: Heavy EV Component Machining",
    uptime: "4d 12h",
    status: "Running",
    throughput: "142 units/h",
    scrapRate: "1.2%",
    total24h: "3,408",
    machines: [
      { id: 101, name: "Power Input", icon: <PowerInputIcon fontSize="large" />, status: "running", cycleTime: 2.0 },
      { id: 102, name: "Cable Routing", icon: <CableIcon fontSize="large" />, status: "running", cycleTime: 3.5 },
      { id: 103, name: "Memory Control", icon: <MemoryIcon fontSize="large" />, status: "running", cycleTime: 1.8 },
      { id: 104, name: "Router Unit", icon: <RouterIcon fontSize="large" />, status: "running", cycleTime: 4.0 },
      { id: 105, name: "Precision Assembly", icon: <PrecisionManufacturingIcon fontSize="large" />, status: "running", cycleTime: 2.5 },
      { id: 106, name: "EV Finalization", icon: <ElectricCarIcon fontSize="large" />, status: "running", cycleTime: 3.0 },
    ]
  },
  {
    id: 2,
    lineCode: "LN-4410",
    name: "Line Beta: Sensor & Optics Calibration",
    uptime: "1d 08h",
    status: "Warning",
    throughput: "98 units/h",
    scrapRate: "2.8%",
    total24h: "2,156",
    machines: [
      { id: 201, name: "Unfold Mechanism", icon: <UnfoldLessIcon fontSize="large" />, status: "running", cycleTime: 2.2 },
      { id: 202, name: "Settings Calibration", icon: <SettingsInputComponentIcon fontSize="large" />, status: "warning", cycleTime: 5.0 },
      { id: 203, name: "Smart Screen", icon: <SmartScreenIcon fontSize="large" />, status: "running", cycleTime: 1.5 },
      { id: 204, name: "Room Mapping", icon: <RoomPreferencesIcon fontSize="large" />, status: "running", cycleTime: 3.0 },
      { id: 205, name: "Scale Verification", icon: <ScaleIcon fontSize="large" />, status: "running", cycleTime: 2.8 },
      { id: 206, name: "Barcode Reader", icon: <BarcodeReaderIcon fontSize="large" />, status: "running", cycleTime: 1.8 },
    ]
  },
  {
    id: 3,
    lineCode: "LN-2291",
    name: "Line Gamma: Heavy Foundry & Welding",
    uptime: "Halted 12m ago",
    status: "Halted",
    throughput: "0 units/h",
    scrapRate: "4.5%",
    total24h: "1,102",
    machines: [
      { id: 301, name: "Factory Entry", icon: <FactoryIcon fontSize="large" />, status: "running", cycleTime: 3.0 },
      { id: 302, name: "Wind Generator", icon: <WindPowerIcon fontSize="large" />, status: "running", cycleTime: 4.5 },
      { id: 303, name: "Tire Repair Jam", icon: <TireRepairIcon fontSize="large" />, status: "error", cycleTime: 0 },
      { id: 304, name: "Heavy Hookup", icon: <RvHookupIcon fontSize="large" />, status: "offline", cycleTime: 0 },
      { id: 305, name: "Heating Station", icon: <FireplaceIcon fontSize="large" />, status: "offline", cycleTime: 0 },
    ]
  },
  {
    id: 4,
    lineCode: "LN-9012",
    name: "Line Delta: Micro-Electronics Solder",
    uptime: "6d 19h",
    status: "Running",
    throughput: "210 units/h",
    scrapRate: "0.5%",
    total24h: "5,040",
    machines: [
      { id: 401, name: "Repartition Matrix", icon: <RepartitionIcon fontSize="large" />, status: "running", cycleTime: 1.5 },
      { id: 402, name: "Ethernet Switch", icon: <SettingsEthernetIcon fontSize="large" />, status: "running", cycleTime: 2.0 },
      { id: 403, name: "Microwave Chamber", icon: <MicrowaveIcon fontSize="large" />, status: "running", cycleTime: 3.5 },
      { id: 404, name: "Dining Assembly", icon: <BrunchDiningIcon fontSize="large" />, status: "running", cycleTime: 2.2 },
      { id: 405, name: "Unarchive Pack", icon: <UnarchiveIcon fontSize="large" />, status: "running", cycleTime: 1.2 },
    ]
  }
];

// Component handling particle generation per segment based on cycle time
function ParticleSegment({
  cycleTime,
  isHalted,
  isError
}: {
  cycleTime: number;
  isHalted: boolean;
  isError: boolean;
}) {
  const [particles, setParticles] = useState<{ id: number }[]>([]);

  useEffect(() => {
    if (isHalted || isError || cycleTime <= 0) return;

    // Spawn first particle right away
    setParticles((prev) => [...prev.slice(-3), { id: Date.now() }]);

    // Spawn new particle every cycleTime seconds
    const interval = setInterval(() => {
      setParticles((prev) => [...prev.slice(-3), { id: Date.now() }]);
    }, cycleTime * 1000);

    return () => clearInterval(interval);
  }, [cycleTime, isHalted, isError]);

  return (
    <div className="flex-1 relative h-[3px] bg-blue-200 self-end mb-[3px] overflow-visible">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full shadow-sm shadow-blue-400 animate-particle-fly"
          onAnimationEnd={() => {
            setParticles((prev) => prev.filter((item) => item.id !== p.id));
          }}
        />
      ))}
    </div>
  );
}

export default function ProductionLinesMockupV2() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center z-10 sticky top-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Production Lines</h1>
          <p className="text-xs text-slate-500">Monitor factory throughput and inter-machine dependencies</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Line
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div className="p-8 space-y-8">
        {productionLinesV2.map((line) => (
          <div
            key={line.id}
            className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${line.status === 'Halted' ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-200'
              }`}
          >
            {/* Card Header */}
            <div
              className={`p-6 border-b flex flex-wrap justify-between items-center gap-4 ${line.status === 'Halted' ? 'border-red-100 bg-red-50/40' : 'border-slate-100 bg-slate-50'
                }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-3 h-3 rounded-full ${line.status === 'Running'
                      ? 'bg-green-500 animate-pulse'
                      : line.status === 'Warning'
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-red-500'
                    }`}
                />
                <div>
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                    {line.name}
                    <span
                      className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-md border ${line.status === 'Running'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : line.status === 'Warning'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                    >
                      {line.status}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    ID: {line.lineCode} | Uptime: {line.uptime}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Throughput</div>
                  <div className="font-bold text-slate-800 font-mono text-base">{line.throughput}</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Scrap Rate</div>
                  <div
                    className={`font-bold font-mono text-base ${parseFloat(line.scrapRate) > 2 ? 'text-amber-600' : 'text-green-600'
                      }`}
                  >
                    {line.scrapRate}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total (24h)</div>
                  <div className="font-bold text-blue-600 font-mono text-base">{line.total24h}</div>
                </div>
                <div className="pl-4 border-l border-slate-200 flex gap-2">
                  {line.status !== 'Halted' ? (
                    <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Square className="w-4 h-4 fill-current" />
                    </button>
                  ) : (
                    <button className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                  )}
                  <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Pipeline Visualization Area */}
            <div className="p-8 overflow-x-auto">
              <div className="relative min-w-max pb-4">

                {/* Main Conveyor Belt Background Line (Reduced by 1px: h-[10px]) */}
                <div
                  className={`absolute top-[44px] left-12 right-12 h-[10px] rounded-full z-0 ${line.status === 'Running'
                      ? 'bg-green-500 conveyor-belt border border-green-600'
                      : line.status === 'Warning'
                        ? 'bg-amber-400 conveyor-belt border border-amber-500'
                        : 'conveyor-halted border border-red-300'
                    }`}
                />

                {/* Machines Row & Inter-Machine Cycle Flow */}
                <div className="relative flex items-start justify-between gap-2 z-10 px-4">
                  {line.machines.map((m, idx) => {
                    const isLast = idx === line.machines.length - 1;

                    return (
                      <div key={m.id} className="flex items-center flex-1">

                        {/* Machine Column Container (Guarantees Diamond is PERFECTLY centered under Machine Icon) */}
                        <div className="flex flex-col items-center w-28 shrink-0 group cursor-pointer">
                          {/* Machine Icon Card */}
                          <div
                            className={`w-16 h-16 rounded-2xl bg-white border-2 shadow-md flex items-center justify-center mb-2 transition-all group-hover:scale-105 ${m.status === 'running'
                                ? 'border-green-500 text-green-600 shadow-green-50'
                                : m.status === 'warning'
                                  ? 'border-amber-400 text-amber-500 ring-4 ring-amber-100'
                                  : m.status === 'error'
                                    ? 'border-red-500 text-red-600 ring-4 ring-red-100 bg-red-50'
                                    : 'border-slate-300 text-slate-400'
                              }`}
                          >
                            {m.icon}
                          </div>

                          {/* Machine Name */}
                          <span className="font-bold text-xs text-slate-700 text-center leading-tight">
                            {m.name}
                          </span>

                          {/* Status Badge */}
                          <span
                            className={`text-[9px] font-extrabold uppercase mt-1 px-2 py-0.5 rounded border ${m.status === 'running'
                                ? 'text-green-700 bg-green-50 border-green-200'
                                : m.status === 'warning'
                                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                                  : m.status === 'error'
                                    ? 'text-red-700 bg-red-50 border-red-200'
                                    : 'text-slate-500 bg-slate-100 border-slate-200'
                              }`}
                          >
                            {m.status}
                          </span>

                          {/* Cycle Time Label */}
                          <span className="text-[10px] text-slate-400 font-mono mt-1">
                            CT: {m.cycleTime > 0 ? `${m.cycleTime}s` : 'N/A'}
                          </span>

                          {/* Small Diamond Marker - DIRECTLY & PERFECTLY CENTERED BELOW THE MACHINE */}
                          <div className="mt-4 relative z-20 w-2.5 h-2.5 rotate-45 bg-blue-600 border border-white shadow-xs shrink-0" />
                        </div>

                        {/* Particle Segment connecting this Machine's diamond to the Next Machine's diamond */}
                        {!isLast && (
                          <ParticleSegment
                            cycleTime={m.cycleTime}
                            isHalted={line.status === 'Halted'}
                            isError={m.status === 'error' || m.status === 'offline'}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Keyframes for Particle Travel & Conveyor Belt Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .conveyor-belt {
          background-image: repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px);
          animation: moveConveyor 2s linear infinite;
        }
        @keyframes moveConveyor {
          0% { background-position: 0 0; }
          100% { background-position: 28px 0; }
        }
        .conveyor-halted {
          background-image: repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(0,0,0,0.05) 10px, rgba(0,0,0,0.05) 20px);
          background-color: #fee2e2;
          animation: pulse-danger 2s ease-in-out infinite;
        }
        @keyframes pulse-danger {
          0% { background-color: #fee2e2; }
          50% { background-color: #f87171; box-shadow: 0 0 15px rgba(248, 113, 113, 0.4); }
          100% { background-color: #fee2e2; }
        }

        @keyframes particleFly {
          0% {
            left: 0%;
            opacity: 0.2;
            transform: translateY(-50%) scale(0.6);
          }
          10% {
            opacity: 1;
            transform: translateY(-50%) scale(1);
          }
          90% {
            opacity: 1;
            transform: translateY(-50%) scale(1);
          }
          100% {
            left: 100%;
            opacity: 0.2;
            transform: translateY(-50%) scale(0.6);
          }
        }
        .animate-particle-fly {
          animation: particleFly 2.5s linear forwards;
        }
      `}} />
    </div>
  );
}
