$ErrorActionPreference = 'Stop'

$base = 'http://localhost:3000'
$orgSlug = 'inovacortex'

function Login-WithCandidates {
    param(
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
        [string]$Endpoint,
        [array]$Candidates
    )

    foreach ($c in $Candidates) {
        try {
            $r = Invoke-WebRequest -Uri "$base$Endpoint" -Method POST -WebSession $Session -UseBasicParsing -ContentType 'application/json' -Body (@{ email=$c.email; password=$c.password } | ConvertTo-Json) -TimeoutSec 20
            return [PSCustomObject]@{ ok=$true; status=[int]$r.StatusCode; body=($r.Content | ConvertFrom-Json); email=$c.email }
        } catch {
            continue
        }
    }

    return [PSCustomObject]@{ ok=$false; status=$null; body=$null; email=$null }
}

function Test-Route {
    param([Microsoft.PowerShell.Commands.WebRequestSession]$Session,[string]$Path)
    $uri = "$base$Path"
    try {
        $resp = Invoke-WebRequest -Uri $uri -WebSession $Session -UseBasicParsing -TimeoutSec 25 -MaximumRedirection 10
        $content = [string]$resp.Content
        [PSCustomObject]@{
            path=$Path
            status=[int]$resp.StatusCode
            finalUrl=$resp.BaseResponse.ResponseUri.AbsoluteUri
            fatalMarker=($content -like '*Application error*' -or $content -like '*Unhandled Runtime Error*' -or $content -like '*Internal Server Error*' -or $content -like '*Something went wrong*')
            redirectedToLogin=($resp.BaseResponse.ResponseUri.AbsoluteUri -like '*login*')
            error=$null
        }
    } catch {
        [PSCustomObject]@{ path=$Path; status=$null; finalUrl=$uri; fatalMarker=$false; redirectedToLogin=$false; error=$_.Exception.Message }
    }
}

$candidates = @(
    @{ email='eduardo@inovacortex.com'; password='M@ncha07' },
    @{ email='admin@inovacortex.com'; password='admin123' }
)

$agencySession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$orgSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$agencyLogin = Login-WithCandidates -Session $agencySession -Endpoint '/api/agency/auth/login' -Candidates $candidates
$orgLogin = Login-WithCandidates -Session $orgSession -Endpoint '/api/auth/login' -Candidates $candidates

$agencyRoutes = @(
    '/agency/dashboard',
    '/agency/command-center',
    '/agency/war-room',
    '/agency/executive-pack',
    '/agency/builder',
    '/agency/pipeline',
    '/agency/sales',
    '/agency/marketing',
    '/agency/marketing/creative',
    '/agency/marketing/publishing',
    '/agency/outreach',
    '/agency/operations'
)

$orgRoutes = @(
    "/org/$orgSlug/admin",
    "/org/$orgSlug/admin/command-center",
    "/org/$orgSlug/admin/executive-pack",
    "/org/$orgSlug/admin/sales",
    "/org/$orgSlug/admin/deals",
    "/org/$orgSlug/admin/cockpit",
    "/org/$orgSlug/admin/marketing",
    "/org/$orgSlug/admin/content",
    "/org/$orgSlug/admin/whatsapp",
    "/org/$orgSlug/admin/performance",
    "/org/$orgSlug/admin/outbound",
    "/org/$orgSlug/admin/workspaces"
)

$agencyResults = @(); foreach ($p in $agencyRoutes) { $agencyResults += Test-Route -Session $agencySession -Path $p }
$orgResults = @(); foreach ($p in $orgRoutes) { $orgResults += Test-Route -Session $orgSession -Path $p }

$health = try {
    $r = Invoke-WebRequest -Uri "$base/api/system/health" -UseBasicParsing -TimeoutSec 20
    [PSCustomObject]@{ status=[int]$r.StatusCode; body=($r.Content | ConvertFrom-Json); error=$null }
} catch { [PSCustomObject]@{ status=$null; body=$null; error=$_.Exception.Message } }

$schedulerUnauth = try {
    $r = Invoke-WebRequest -Uri "$base/api/system/scheduler" -Method POST -UseBasicParsing -TimeoutSec 20
    [PSCustomObject]@{ status=[int]$r.StatusCode; body=($r.Content | ConvertFrom-Json); error=$null }
} catch {
    $resp = $_.Exception.Response
    if ($resp) {
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $bodyText = $reader.ReadToEnd()
        [PSCustomObject]@{ status=[int]$resp.StatusCode.value__; body=$bodyText; error='unauthorized_or_error' }
    } else {
        [PSCustomObject]@{ status=$null; body=$null; error=$_.Exception.Message }
    }
}

$report = [PSCustomObject]@{
    generatedAt=(Get-Date).ToString('o')
    baseUrl=$base
    authCandidatesTested=($candidates | ForEach-Object { $_.email })
    agencyLogin=$agencyLogin
    orgLogin=$orgLogin
    agencyRoutes=$agencyResults
    orgRoutes=$orgResults
    health=$health
    schedulerUnauth=$schedulerUnauth
}

$report | ConvertTo-Json -Depth 8 | Set-Content '.tmp/http-auth-smoke-report.json'
'http_auth_smoke_done'
