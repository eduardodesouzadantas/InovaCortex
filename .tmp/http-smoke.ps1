$ErrorActionPreference = 'Stop'

function Get-EnvMap {
    $map = @{}
    if (Test-Path '.env') {
        Get-Content '.env' | ForEach-Object {
            $line = $_.Trim()
            if (-not $line -or $line.StartsWith('#')) { return }
            $idx = $line.IndexOf('=')
            if ($idx -le 0) { return }
            $k = $line.Substring(0, $idx).Trim()
            $v = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
            $map[$k] = $v
        }
    }
    return $map
}

$envMap = Get-EnvMap
$base = if ($envMap.ContainsKey('NEXT_PUBLIC_BASE_URL')) { $envMap['NEXT_PUBLIC_BASE_URL'] } else { 'http://localhost:3000' }
$orgSlug = if ($envMap.ContainsKey('AGENCY_ORG_SLUG')) { $envMap['AGENCY_ORG_SLUG'] } else { 'inovacortex' }
$email = $envMap['ADMIN_EMAIL']
$password = $envMap['ADMIN_PASSWORD']
$cronSecret = if ($envMap.ContainsKey('CRON_SECRET')) { $envMap['CRON_SECRET'] } else { '' }

function Test-Route {
    param([Microsoft.PowerShell.Commands.WebRequestSession]$Session,[string]$Path)
    $uri = "$base$Path"
    try {
        $resp = Invoke-WebRequest -Uri $uri -WebSession $Session -UseBasicParsing -TimeoutSec 20 -MaximumRedirection 10
        $content = [string]$resp.Content
        $fatal = ($content -like '*Application error*' -or $content -like '*Unhandled Runtime Error*' -or $content -like '*Internal Server Error*' -or $content -like '*Something went wrong*')
        [PSCustomObject]@{
            path=$Path
            status=[int]$resp.StatusCode
            finalUrl=$resp.BaseResponse.ResponseUri.AbsoluteUri
            fatalMarker=$fatal
            isLoginPage=($content -like '*Mission Control*' -or $content -like '*Agency Access*')
            error=$null
        }
    } catch {
        [PSCustomObject]@{ path=$Path; status=$null; finalUrl=$uri; fatalMarker=$false; isLoginPage=$false; error=$_.Exception.Message }
    }
}

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

$agencySession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$orgSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$agencyLogin = try {
    $r = Invoke-WebRequest -Uri "$base/api/agency/auth/login" -Method POST -WebSession $agencySession -UseBasicParsing -ContentType 'application/json' -Body (@{ email=$email; password=$password } | ConvertTo-Json) -TimeoutSec 20
    [PSCustomObject]@{ status=[int]$r.StatusCode; body=($r.Content | ConvertFrom-Json); error=$null }
} catch {
    [PSCustomObject]@{ status=$null; body=$null; error=$_.Exception.Message }
}

$agencyResults = @(); foreach ($p in $agencyRoutes) { $agencyResults += Test-Route -Session $agencySession -Path $p }

$orgLogin = try {
    $r = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -WebSession $orgSession -UseBasicParsing -ContentType 'application/json' -Body (@{ email=$email; password=$password } | ConvertTo-Json) -TimeoutSec 20
    [PSCustomObject]@{ status=[int]$r.StatusCode; body=($r.Content | ConvertFrom-Json); error=$null }
} catch {
    [PSCustomObject]@{ status=$null; body=$null; error=$_.Exception.Message }
}

$orgResults = @(); foreach ($p in $orgRoutes) { $orgResults += Test-Route -Session $orgSession -Path $p }

$health = try {
    $r = Invoke-WebRequest -Uri "$base/api/system/health" -UseBasicParsing -TimeoutSec 20
    [PSCustomObject]@{ status=[int]$r.StatusCode; body=($r.Content | ConvertFrom-Json); error=$null }
} catch {
    [PSCustomObject]@{ status=$null; body=$null; error=$_.Exception.Message }
}

$scheduler = try {
    $headers = @{}
    if ($cronSecret) { $headers['x-cron-secret'] = $cronSecret }
    $r = Invoke-WebRequest -Uri "$base/api/system/scheduler" -Method POST -Headers $headers -UseBasicParsing -TimeoutSec 30
    [PSCustomObject]@{ status=[int]$r.StatusCode; body=($r.Content | ConvertFrom-Json); error=$null; usedSecret=[bool]$cronSecret }
} catch {
    [PSCustomObject]@{ status=$null; body=$null; error=$_.Exception.Message; usedSecret=[bool]$cronSecret }
}

$report = [PSCustomObject]@{
    baseUrl=$base
    orgSlug=$orgSlug
    agencyLogin=$agencyLogin
    orgLogin=$orgLogin
    agencyRoutes=$agencyResults
    orgRoutes=$orgResults
    health=$health
    scheduler=$scheduler
    generatedAt=(Get-Date).ToString('o')
}

$report | ConvertTo-Json -Depth 8 | Set-Content '.tmp/http-smoke-report.json'
'http_smoke_done'
