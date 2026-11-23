import React from 'react';
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

export const TwoCogsIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <g transform="translate(-1, -1) scale(0.6)">
            <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
        </g>
        <g transform="translate(8.5, 8.5) scale(0.6)">
            <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
        </g>
    </svg>
);

const ICON_MAP: Record<string, React.ReactElement> = {
    PrecisionManufacturing: <PrecisionManufacturingIcon fontSize="inherit" />,
    Factory: <FactoryIcon fontSize="inherit" />,
    PowerInput: <PowerInputIcon fontSize="inherit" />,
    Cable: <CableIcon fontSize="inherit" />,
    Memory: <MemoryIcon fontSize="inherit" />,
    Router: <RouterIcon fontSize="inherit" />,
    ElectricCar: <ElectricCarIcon fontSize="inherit" />,
    Compress: <CompressIcon fontSize="inherit" />,
    SettingsInputComponent: <SettingsInputComponentIcon fontSize="inherit" />,
    SmartScreen: <SmartScreenIcon fontSize="inherit" />,
    RoomPreferences: <RoomPreferencesIcon fontSize="inherit" />,
    Scale: <ScaleIcon fontSize="inherit" />,
    BarcodeReader: <BarcodeReaderIcon fontSize="inherit" />,
    WindPower: <WindPowerIcon fontSize="inherit" />,
    TireRepair: <TireRepairIcon fontSize="inherit" />,
    RvHookup: <RvHookupIcon fontSize="inherit" />,
    Fireplace: <FireplaceIcon fontSize="inherit" />,
    Repartition: <RepartitionIcon fontSize="inherit" />,
    SettingsEthernet: <SettingsEthernetIcon fontSize="inherit" />,
    Microwave: <MicrowaveIcon fontSize="inherit" />,
    BrunchDining: <BrunchDiningIcon fontSize="inherit" />,
    Unarchive: <UnarchiveIcon fontSize="inherit" />,
    ModelTraining: <ModelTrainingIcon fontSize="inherit" />,
    MoreHoriz: <MoreHorizIcon fontSize="inherit" />,
    'fa-cogs': <TwoCogsIcon className="w-full h-full" />,
    Air: <AirIcon fontSize="inherit" />,
    FilterAlt: <FilterAltIcon fontSize="inherit" />,
    Shower: <ShowerIcon fontSize="inherit" />,
    ViewQuilt: <ViewQuiltIcon fontSize="inherit" />,
    Tune: <TuneIcon fontSize="inherit" />,

    // Fallbacks for legacy FontAwesome icon names from previous DB versions
    'fa-pallet': <UnarchiveIcon fontSize="inherit" />,
    'fa-compress-alt': <CompressIcon fontSize="inherit" />,
    'fa-robot': <PrecisionManufacturingIcon fontSize="inherit" />,
    'fa-paint-roller': <ShowerIcon fontSize="inherit" />,
    'fa-microscope': <BarcodeReaderIcon fontSize="inherit" />,
    'fa-box': <UnarchiveIcon fontSize="inherit" />,
    'fa-fire': <FireplaceIcon fontSize="inherit" />,
    'fa-search': <ScaleIcon fontSize="inherit" />,
    'fa-fan': <AirIcon fontSize="inherit" />,
    'fa-snowflake': <WindPowerIcon fontSize="inherit" />,
    'fa-water': <PowerInputIcon fontSize="inherit" />,
};

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

interface MachineIconProps {
    name?: string | null;
    className?: string;
    fontSize?: 'inherit' | 'small' | 'medium' | 'large';
}

export default function MachineIcon({ name, className = "w-7 h-7 text-current flex items-center justify-center", fontSize = "inherit" }: MachineIconProps) {
    if (!name) {
        return (
            <span className={className} style={{ fontSize: fontSize !== 'inherit' ? undefined : '1.75rem' }}>
                <PrecisionManufacturingIcon fontSize={fontSize} />
            </span>
        );
    }

    const iconElement = ICON_MAP[name] ?? <PrecisionManufacturingIcon fontSize={fontSize} />;

    return (
        <span className={className} style={{ fontSize: fontSize !== 'inherit' ? undefined : '1.75rem' }}>
            {iconElement}
        </span>
    );
}
