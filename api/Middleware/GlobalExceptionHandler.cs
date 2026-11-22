using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using SmartFactoryCMMS.Api.Simulation;
using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

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

            if (exception is StackExchange.Redis.RedisException or Microsoft.Data.SqlClient.SqlException ||
                exception is DbUpdateException { InnerException: Microsoft.Data.SqlClient.SqlException })
            {
                _logger.LogError(exception, "Persistence service unavailable. TraceId: {TraceId}", traceId);
                httpContext.Response.StatusCode = 503;
                await httpContext.Response.WriteAsJsonAsync(new { message = "The data service is unavailable. Retry when connectivity is restored.", traceId }, cancellationToken);
                return true;
            }

            if (exception is SimulationRequestException or ValidationException or DbUpdateConcurrencyException)
            {
                var status = exception is SimulationRequestException request ? request.StatusCode : exception is DbUpdateConcurrencyException ? 409 : 400;
                httpContext.Response.StatusCode = status;
                await httpContext.Response.WriteAsJsonAsync(new { message = exception.Message, traceId }, cancellationToken);
                return true;
            }

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
