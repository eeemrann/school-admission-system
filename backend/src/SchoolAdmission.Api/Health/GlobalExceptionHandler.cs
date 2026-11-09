using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace SchoolAdmission.Api.Health;

public sealed partial class GlobalExceptionHandler(
    ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        LogUnhandledException(exception, httpContext.Request.Method, httpContext.Request.Path);

        var problem = new ProblemDetails
        {
            Type = "https://example.invalid/problems/internal-error",
            Title = "An unexpected error occurred.",
            Status = StatusCodes.Status500InternalServerError,
            Detail = "The request could not be completed.",
            Instance = httpContext.Request.Path
        };
        problem.Extensions["code"] = "INTERNAL_ERROR";

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        httpContext.Response.ContentType = "application/problem+json";
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);

        return true;
    }

    [LoggerMessage(
        Level = LogLevel.Error,
        Message = "Unhandled exception while processing {method} {path}.")]
    private partial void LogUnhandledException(Exception exception, string method, string path);
}
