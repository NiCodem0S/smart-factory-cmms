using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;
using SmartFactoryCMMS.Api.Configuration;

namespace SmartFactoryCMMS.Api.Filters
{
    [AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
    public class PagingValidationAttribute : ActionFilterAttribute
    {
        public string PageArgumentName { get; set; } = "page";
        public string PageSizeArgumentName { get; set; } = "pageSize";

        // These values can be overridden by configuration via IOptions if provided
        public int MinPage { get; set; } = 1;
        public int MinPageSize { get; set; } = 1;
        public int MaxPageSize { get; set; } = 100;

        public string? LimitArgumentName { get; set; }
        public int MinLimit { get; set; } = 1;
        public int MaxLimit { get; set; } = 1000;

        public override void OnActionExecuting(ActionExecutingContext context)
        {
            // Try to get configured options from DI if available
            try
            {
                var opts = context.HttpContext.RequestServices.GetService(typeof(IOptions<PagingOptions>)) as IOptions<PagingOptions>;
                if (opts?.Value != null)
                {
                    var cfg = opts.Value;
                    MinPage = cfg.MinPage;
                    MinPageSize = cfg.MinPageSize;
                    MaxPageSize = cfg.MaxPageSize;
                    // Only set LimitArgumentName if not already overridden on attribute usage
                    if (string.IsNullOrEmpty(LimitArgumentName)) LimitArgumentName = cfg.LimitArgumentName;
                    MinLimit = cfg.MinLimit;
                    MaxLimit = cfg.MaxLimit;
                }
            }
            catch
            {
                // ignore DI resolution errors and fall back to defaults
            }
            // Validate page
            if (context.ActionArguments.TryGetValue(PageArgumentName, out var pageObj) && pageObj is int page)
            {
                if (page < MinPage)
                {
                    context.Result = new BadRequestObjectResult(new { message = $"{PageArgumentName} must be >= {MinPage}." });
                    return;
                }
            }

            // Validate pageSize
            if (context.ActionArguments.TryGetValue(PageSizeArgumentName, out var psObj) && psObj is int pageSize)
            {
                if (pageSize < MinPageSize || pageSize > MaxPageSize)
                {
                    context.Result = new BadRequestObjectResult(new { message = $"{PageSizeArgumentName} must be between {MinPageSize} and {MaxPageSize}." });
                    return;
                }
            }

            // Validate/Clamp limit if present
            if (!string.IsNullOrEmpty(LimitArgumentName) && context.ActionArguments.TryGetValue(LimitArgumentName!, out var limitObj) && limitObj is int limit)
            {
                if (limit < MinLimit)
                {
                    context.Result = new BadRequestObjectResult(new { message = $"{LimitArgumentName} must be >= {MinLimit}." });
                    return;
                }

                if (limit > MaxLimit)
                {
                    // clamp the value so repository receives a safe cap
                    context.ActionArguments[LimitArgumentName!] = MaxLimit;
                }
            }

            base.OnActionExecuting(context);
        }
    }
}
