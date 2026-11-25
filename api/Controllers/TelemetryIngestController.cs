using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartFactoryCMMS.Api.DTOs;
using SmartFactoryCMMS.Api.Services;

namespace SmartFactoryCMMS.Api.Controllers;

[ApiController]
[Route("api/telemetry")]
public sealed class TelemetryIngestController(TelemetryIngestionService ingestion) : ControllerBase
{
    public const string DeviceKeyHeader = "X-Device-Key";

    [AllowAnonymous]
    [HttpPost("ingest")]
    public async Task<ActionResult<TelemetryIngestResultDto>> Ingest(
        [FromBody] TelemetryIngestRequestDto request,
        CancellationToken ct = default)
    {
        Request.Headers.TryGetValue(DeviceKeyHeader, out var keyValues);
        var rawKey = keyValues.FirstOrDefault();
        var result = await ingestion.IngestAsync(rawKey, request, ct);
        return Accepted(result);
    }
}
