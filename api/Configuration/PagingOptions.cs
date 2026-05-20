namespace SmartFactoryCMMS.Api.Configuration
{
    public class PagingOptions
    {
        public int MinPage { get; set; } = 1;
        public int MinPageSize { get; set; } = 1;
        public int MaxPageSize { get; set; } = 100;

        public string? LimitArgumentName { get; set; } = "limit";
        public int MinLimit { get; set; } = 1;
        public int MaxLimit { get; set; } = 1000;
    }
}
