using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;

namespace SmartFactoryCMMS.Api.Middleware
{
    public class GlobalExceptionHandler : IExceptionHandler
    {
        private readonly ILogger<GlobalExceptionHandler> _logger;

        public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
        {
            _logger = logger;
        }

        public async ValueTask<bool> TryHandleAsync(
            HttpContext httpContext,
            Exception exception,
            CancellationToken cancellationToken)
        {
            var traceId = Activity.Current?.Id ?? httpContext.TraceIdentifier;

            if (exception is OperationCanceledException)
            {
                _logger.LogInformation("Request cancelled by client. Path: {Path}, TraceId: {TraceId}", 
                    httpContext.Request.Path, traceId);
                httpContext.Response.StatusCode = 499; // Client Closed Request
                return true;
            }

            _logger.LogError(exception, 
                "Unhandled exception occurred while processing request: {Method} {Path}. TraceId: {TraceId}. Error: {Message}",
                httpContext.Request.Method,
                httpContext.Request.Path,
                traceId,
                exception.Message);

            httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
            httpContext.Response.ContentType = "application/problem+json";
            var problemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Internal Server Error",
                Detail = "An unexpected error occurred on the server. Please provide the TraceId to technical support.",
                Instance = httpContext.Request.Path,
                Extensions =
                {
                    ["traceId"] = traceId
                }
            };
            await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);
            return true;
        }
    }
}