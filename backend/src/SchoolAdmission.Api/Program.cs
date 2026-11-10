using System.Globalization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Health;
using SchoolAdmission.Application.Abstractions.Persistence;
using SchoolAdmission.Application.Classes;
using SchoolAdmission.Application.Reservations;
using SchoolAdmission.Infrastructure.Persistence;
using SchoolAdmission.Infrastructure.Persistence.Repositories;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var problem = new ValidationProblemDetails(context.ModelState)
        {
            Type = "https://example.invalid/problems/validation-error",
            Title = "Validation failed",
            Status = StatusCodes.Status400BadRequest,
            Detail = "One or more request fields are invalid.",
            Instance = context.HttpContext.Request.Path
        };
        problem.Extensions["code"] = "VALIDATION_ERROR";

        return new BadRequestObjectResult(problem)
        {
            ContentTypes = ["application/problem+json"]
        };
    };
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSingleton(TimeProvider.System);
var rawHoldDuration = builder.Configuration["HOLD_DURATION_SECONDS"];
var holdDurationSeconds = HoldConfiguration.DefaultDurationSeconds;
if (rawHoldDuration is not null
    && (!int.TryParse(rawHoldDuration, NumberStyles.Integer, CultureInfo.InvariantCulture, out holdDurationSeconds)
        || holdDurationSeconds <= 0))
{
    throw new InvalidOperationException(
        "HOLD_DURATION_SECONDS must be a positive integer when specified.");
}

builder.Services.AddSingleton(new HoldConfiguration(holdDurationSeconds));
builder.Services.AddScoped<IClassManagementService, ClassManagementService>();
builder.Services.AddScoped<IAdmissionClassRepository, EfAdmissionClassRepository>();
builder.Services.AddScoped<IHoldReservationService, HoldReservationService>();
builder.Services.AddScoped<IAdmissionHoldRepository, EfAdmissionHoldRepository>();
builder.Services.AddDbContext<SchoolAdmissionDbContext>(options =>
{
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        options.UseNpgsql();
    }
    else
    {
        options.UseNpgsql(connectionString);
    }
});
builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

var app = builder.Build();

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapControllers();
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = HealthResponseWriter.WriteAsync
});

app.Run();

public partial class Program;
