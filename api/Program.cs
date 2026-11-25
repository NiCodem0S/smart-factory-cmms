using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SmartFactoryCMMS.Api.Data;
using SmartFactoryCMMS.Api.Models;
using SmartFactoryCMMS.Api.Repositories;
using SmartFactoryCMMS.Api.Repositories.Abstract;
using SmartFactoryCMMS.Api.Services;
using SmartFactoryCMMS.Api.Services.Abstract;
using Serilog;
using SmartFactoryCMMS.Api.Simulation;
using SmartFactoryCMMS.Api.Hubs;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Database.Command", Serilog.Events.LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore", Serilog.Events.LogEventLevel.Warning)
    .WriteTo.Console()
    .WriteTo.File(
        path: "Logs/cmms-log-.txt",
        rollingInterval: RollingInterval.Day, // Nowy plik codziennie
        retainedFileCountLimit: 14            // Usuwa pliki starsze niż 14 dni
    )
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    options.UseSqlServer(connectionString);
});

builder.Services.AddAutoMapper(config =>
{
    config.AddMaps(typeof(Program).Assembly);
});
// Add services to the container.

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});
builder.Services.AddEndpointsApiExplorer();

// Swagger with JWT Bearer support
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "SmartFactoryCMMS API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// JWT Authentication Setup
var jwtSecretKey = builder.Configuration["Jwt:SecretKey"]
    ?? throw new InvalidOperationException("JWT SecretKey is missing in configuration.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            if (context.HttpContext.Request.Path.StartsWithSegments("/hubs/telemetry") &&
                context.Request.Query.TryGetValue("access_token", out var token)) context.Token = token;
            return Task.CompletedTask;
        }
    };
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey)),
        ValidateIssuer = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidateAudience = true,
        ValidAudience = builder.Configuration["Jwt:Audience"],
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "https://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddHttpContextAccessor();

// Dependency Injection
builder.Services.AddScoped<IMachineRepository, MachineRepository>();
builder.Services.AddScoped<IWorkOrderRepository, WorkOrderRepository>();
builder.Services.AddScoped<IFactoryHallRepository, FactoryHallRepository>();
builder.Services.AddScoped<IProductionLinesRepository, ProductionLinesRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<IRefreshTokenService, RefreshTokenService>();
builder.Services.AddScoped<IUserContext, UserContext>();
builder.Services.AddSingleton<RedisConnectionProvider>();
builder.Services.AddHealthChecks().AddCheck<RedisHealthCheck>("simulation-redis");
builder.Services.AddSingleton<ISimulationStateStore, RedisSimulationStateStore>();
builder.Services.AddSingleton<SimulationDiagnostics>();
builder.Services.AddSingleton<TelemetryChannel>();
builder.Services.AddSingleton<ITelemetryHistoryQueue, RedisTelemetryStreamQueue>();
builder.Services.AddSingleton<TelemetryIngestionService>();
builder.Services.AddScoped<ISimulationCheckpointStore, SimulationCheckpointStore>();
builder.Services.AddSignalR().AddJsonProtocol(o =>
    o.PayloadSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddSingleton<SimulationOrchestrator>();
builder.Services.AddHostedService<TelemetryPersister>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<SimulationOrchestrator>());
builder.Services.AddHostedService<SimulationAutomationService>();
builder.Services.AddHostedService<SimulationCheckpointService>();
builder.Services.AddHostedService<TelemetryRetentionService>();
builder.Services.AddHostedService<DeviceWatchdogService>();
builder.Services.AddOptions<SmartFactoryCMMS.Api.Configuration.SimulationOptions>()
    .Bind(builder.Configuration.GetSection(SmartFactoryCMMS.Api.Configuration.SimulationOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

// Paging options from configuration
builder.Services.Configure<SmartFactoryCMMS.Api.Configuration.PagingOptions>(builder.Configuration.GetSection("Paging"));
builder.Services.AddScoped<SmartFactoryCMMS.Api.Filters.PagingValidationAttribute>();

builder.Services.AddExceptionHandler<SmartFactoryCMMS.Api.Middleware.GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseExceptionHandler();

app.UseCors("AllowReactApp");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<TelemetryHub>("/hubs/telemetry", options => options.CloseOnAuthenticationExpiration = true);
app.MapHealthChecks("/health/simulation-redis")
    .RequireAuthorization(new AuthorizeAttribute { Roles = "SuperAdmin,HallAdmin" });

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        DatabaseSeeder.Seed(context);
        SimulationProfileSeeder.Seed(context);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error occurred during seeding data: {ex}");
    }
}

app.Run();
