# syntax=docker/dockerfile:1.7

# The repository pins SDK 10.0.114 in global.json. That exact SDK is
# published by Microsoft but is not exposed as an MCR SDK image tag, so the
# official .NET 10 SDK image is used as the build base and the exact SDK archive
# is installed and checksum-verified below.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

ARG DOTNET_SDK_VERSION=10.0.114
ARG DOTNET_SDK_SHA512_AMD64=65d2ea31a31e2fc7e677aad7ac84a42f85dd8383cdd9060f75c469ac553a08fce18c1cb76db92ab0ae84505c72278fd55568f46d6595e6a121d2fd9f0bd024df
ARG DOTNET_SDK_SHA512_ARM64=8eed6c8ab640f06c34f84841f9bdf040c75d9ba4926f823ce2cf56ce009c2a9c11f795332c559b960e4f46ce5777d39ab5a772274edc428601df9eb4df013684
ARG TARGETARCH

ENV DOTNET_ROOT=/opt/dotnet-sdk
ENV PATH="${DOTNET_ROOT}:${PATH}"

WORKDIR /src

RUN case "${TARGETARCH}" in \
        amd64) sdk_rid="linux-x64"; sdk_sha512="${DOTNET_SDK_SHA512_AMD64}" ;; \
        arm64) sdk_rid="linux-arm64"; sdk_sha512="${DOTNET_SDK_SHA512_ARM64}" ;; \
        *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && mkdir -p "${DOTNET_ROOT}" \
    && curl --fail --silent --show-error --location --retry 3 \
        "https://builds.dotnet.microsoft.com/dotnet/Sdk/${DOTNET_SDK_VERSION}/dotnet-sdk-${DOTNET_SDK_VERSION}-${sdk_rid}.tar.gz" \
        --output /tmp/dotnet-sdk.tar.gz \
    && echo "${sdk_sha512}  /tmp/dotnet-sdk.tar.gz" | sha512sum --check --strict \
    && tar --extract --gzip --file /tmp/dotnet-sdk.tar.gz --directory "${DOTNET_ROOT}" \
    && rm /tmp/dotnet-sdk.tar.gz \
    && test "$(dotnet --version)" = "${DOTNET_SDK_VERSION}"

# Keep restore inputs separate from source so ordinary code changes do not
# invalidate the NuGet restore layer.
COPY global.json Directory.Build.props Directory.Packages.props ./
COPY backend/SchoolAdmission.sln ./backend/SchoolAdmission.sln
COPY backend/src/SchoolAdmission.Domain/SchoolAdmission.Domain.csproj ./backend/src/SchoolAdmission.Domain/
COPY backend/src/SchoolAdmission.Application/SchoolAdmission.Application.csproj ./backend/src/SchoolAdmission.Application/
COPY backend/src/SchoolAdmission.Infrastructure/SchoolAdmission.Infrastructure.csproj ./backend/src/SchoolAdmission.Infrastructure/
COPY backend/src/SchoolAdmission.Api/SchoolAdmission.Api.csproj ./backend/src/SchoolAdmission.Api/
COPY backend/src/SchoolAdmission.Migrator/SchoolAdmission.Migrator.csproj ./backend/src/SchoolAdmission.Migrator/

RUN dotnet restore backend/src/SchoolAdmission.Api/SchoolAdmission.Api.csproj
RUN dotnet restore backend/src/SchoolAdmission.Migrator/SchoolAdmission.Migrator.csproj

COPY .editorconfig ./
COPY backend ./backend

FROM build AS api-build

RUN dotnet publish backend/src/SchoolAdmission.Api/SchoolAdmission.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish \
    /p:UseAppHost=false

FROM build AS migrator-build

RUN dotnet publish backend/src/SchoolAdmission.Migrator/SchoolAdmission.Migrator.csproj \
    --configuration Release \
    --no-restore \
    --output /app/migrator-publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0.14 AS runtime-base

WORKDIR /app

FROM runtime-base AS migrator

COPY --from=migrator-build /app/migrator-publish ./

USER app

ENTRYPOINT ["dotnet", "SchoolAdmission.Migrator.dll"]

FROM runtime-base AS api

# Compose uses curl for the HTTP readiness probe. Keep this dependency in the
# API runtime only so the one-shot migrator remains minimal.
USER root

RUN apt-get update \
    && apt-get install --no-install-recommends --yes curl \
    && rm -rf /var/lib/apt/lists/*

ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://+:8080

EXPOSE 8080

COPY --from=api-build /app/publish ./

# The official ASP.NET runtime image provides the unprivileged `app` user.
USER app

ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]
