using Microsoft.AspNetCore.Mvc;

namespace SchoolAdmission.Api.Errors;

public static class ApiProblemDetails
{
    public static ObjectResult Create(
        HttpContext httpContext,
        int status,
        string code,
        string title,
        string type,
        string detail,
        IReadOnlyDictionary<string, string[]>? errors = null)
    {
        var problem = new ProblemDetails
        {
            Type = $"https://example.invalid/problems/{type}",
            Title = title,
            Status = status,
            Detail = detail,
            Instance = httpContext.Request.Path
        };
        problem.Extensions["code"] = code;

        if (errors is not null)
        {
            problem.Extensions["errors"] = errors;
        }

        return new ObjectResult(problem)
        {
            StatusCode = status,
            ContentTypes = ["application/problem+json"]
        };
    }
}
