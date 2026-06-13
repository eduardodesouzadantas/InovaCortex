param(
    [string]$BaseUrl = "https://inovacortex-site.vercel.app",
    [string]$OrgSlug = "inovacortex",
    [string]$OutputPath = "artifacts/whatsapp-crm-prod-validation.json"
)

$ErrorActionPreference = "Stop"

function Get-EnvValue([string]$Name) {
    $line = Select-String -Path ".env" -Pattern "^$Name=(.*)$" | Select-Object -First 1
    if (-not $line) {
        throw "Missing env var: $Name"
    }

    $value = $line.Matches[0].Groups[1].Value.Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
    }

    return $value
}

function Get-ConversationsFromBody($Body) {
    if ($null -eq $Body) {
        return @()
    }

    if ($Body.PSObject.Properties.Name -contains "conversations") {
        return @($Body.conversations)
    }

    if (($Body.PSObject.Properties.Name -contains "data") -and $Body.data) {
        if ($Body.data.PSObject.Properties.Name -contains "conversations") {
            return @($Body.data.conversations)
        }
    }

    return @()
}

function Invoke-WebRequestSafe {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$RequestBlock
    )

    try {
        $response = & $RequestBlock
        return [pscustomobject]@{
            ok = $true
            status = $response.StatusCode
            content = $response.Content
            headers = $response.Headers
            raw = $response
        }
    } catch {
        $exception = $_.Exception
        $webResponse = $exception.Response
        $statusCode = $null
        $content = $null
        $headers = $null

        if ($webResponse) {
            $statusCode = [int]$webResponse.StatusCode
            $headers = $webResponse.Headers
            $reader = New-Object System.IO.StreamReader($webResponse.GetResponseStream())
            $content = $reader.ReadToEnd()
            $reader.Close()
        }

        return [pscustomobject]@{
            ok = $false
            status = $statusCode
            content = $content
            headers = $headers
            raw = $null
            error = $exception.Message
        }
    }
}

Set-Location (Split-Path -Parent $PSScriptRoot)

$adminEmail = Get-EnvValue "ADMIN_EMAIL"
$adminPassword = Get-EnvValue "ADMIN_PASSWORD"
$appSecret = Get-EnvValue "META_APP_SECRET"
$phoneNumberId = Get-EnvValue "META_PHONE_NUMBER_ID"

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$suffix = Get-Random -Minimum 100000 -Maximum 999999
$fromPhone = "551199$suffix"
$messageId = "wamid.inovacortex.e2e.$stamp.$suffix"
$messageText = "InovaCortex E2E CRM $stamp-$suffix"
$profileName = "E2E CRM $suffix"

$payloadObject = [ordered]@{
    object = "whatsapp_business_account"
    entry = @(
        [ordered]@{
            id = "e2e-entry"
            changes = @(
                [ordered]@{
                    field = "messages"
                    value = [ordered]@{
                        metadata = [ordered]@{
                            phone_number_id = $phoneNumberId
                        }
                        contacts = @(
                            [ordered]@{
                                profile = [ordered]@{ name = $profileName }
                                wa_id = $fromPhone
                            }
                        )
                        messages = @(
                            [ordered]@{
                                from = $fromPhone
                                id = $messageId
                                timestamp = "$stamp"
                                type = "text"
                                text = [ordered]@{
                                    body = $messageText
                                }
                            }
                        )
                    }
                }
            )
        }
    )
}

$rawBody = $payloadObject | ConvertTo-Json -Depth 20 -Compress
$hmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($appSecret))
$signatureBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($rawBody))
$signature = "sha256=" + ([System.BitConverter]::ToString($signatureBytes).Replace("-", "").ToLowerInvariant())

$webhookStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$webhookResult = Invoke-WebRequestSafe { Invoke-WebRequest -Uri "$BaseUrl/api/webhooks/meta" -Method POST -ContentType "application/json" -Headers @{ "x-hub-signature-256" = $signature } -Body $rawBody }
$webhookStopwatch.Stop()
$webhookBody = if ($webhookResult.content) { try { $webhookResult.content | ConvertFrom-Json } catch { $webhookResult.content } } else { $null }

$loginPayload = @{ email = $adminEmail; password = $adminPassword } | ConvertTo-Json -Compress
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$loginResult = Invoke-WebRequestSafe { Invoke-WebRequest -Uri "$BaseUrl/api/agency/auth/login" -Method POST -ContentType "application/json" -Body $loginPayload -WebSession $session }
$loginStopwatch.Stop()
$loginBody = if ($loginResult.content) { try { $loginResult.content | ConvertFrom-Json } catch { $loginResult.content } } else { $null }

Start-Sleep -Seconds 4

$inboxStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$inboxResult = Invoke-WebRequestSafe { Invoke-WebRequest -Uri "$BaseUrl/api/org/$OrgSlug/whatsapp/conversations?status=open&limit=100" -WebSession $session }
$inboxStopwatch.Stop()
$inboxBody = if ($inboxResult.content) { try { $inboxResult.content | ConvertFrom-Json } catch { $inboxResult.content } } else { $null }
$conversations = Get-ConversationsFromBody $inboxBody

$targetConversation = $conversations | Where-Object {
    ($_.contact -and $_.contact.phoneNumberE164 -eq $fromPhone) -or
    (@($_.messages) | Where-Object { $_.messageId -eq $messageId }).Count -gt 0
} | Select-Object -First 1

$result = [ordered]@{
    executedAt = (Get-Date).ToString("o")
    baseUrl = $BaseUrl
    testInput = [ordered]@{
        orgSlug = $OrgSlug
        phoneNumberId = $phoneNumberId
        fromPhone = $fromPhone
        messageId = $messageId
        messageText = $messageText
    }
    webhook = [ordered]@{
        ok = $webhookResult.ok
        status = $webhookResult.status
        latencyMs = $webhookStopwatch.ElapsedMilliseconds
        body = $webhookBody
        error = $webhookResult.error
    }
    login = [ordered]@{
        ok = $loginResult.ok
        status = $loginResult.status
        latencyMs = $loginStopwatch.ElapsedMilliseconds
        success = if ($loginBody) { $loginBody.success } else { $null }
        cookieCount = if ($session) { @($session.Cookies.GetCookies($BaseUrl)).Count } else { 0 }
        body = $loginBody
        error = $loginResult.error
    }
    inbox = [ordered]@{
        ok = $inboxResult.ok
        status = $inboxResult.status
        latencyMs = $inboxStopwatch.ElapsedMilliseconds
        totalConversationsReturned = @($conversations).Count
        foundConversation = [bool]$targetConversation
        conversation = $targetConversation
        body = $inboxBody
        error = $inboxResult.error
    }
}

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir -and -not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$json = $result | ConvertTo-Json -Depth 20
Set-Content -Path $OutputPath -Value $json
$json
