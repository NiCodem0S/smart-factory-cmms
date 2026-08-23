namespace SmartFactoryCMMS.Api.Helpers.Enums
{
    public enum UserRole
    {
        SuperAdmin,   // Globalny dostęp do wszystkich hal, użytkowników i konfiguracji
        HallAdmin,    // Pełne zarządzanie maszynami i zleceniami na swojej hali
        Technician   // Realizacja i przyjmowanie zleceń napraw (WorkOrders)
    }
}
