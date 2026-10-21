$ErrorActionPreference = "Stop"

function Test-PublicLexiconAndUsability {
    Write-Host "`n[Step 3/4] Running Test-PublicLexiconAndUsability (Banned Jargon & Krug Usability Gate)..." -ForegroundColor Yellow

    $publicComponentAndRouteFiles = @(
        "src/components/IncidentBriefClient.tsx",
        "src/components/IncidentCard.tsx",
        "src/components/TrestleboardClient.tsx",
        "src/components/RubricInspectorDrawer.tsx",
        "src/components/RubricCodexClient.tsx",
        "src/components/KnowledgeGraphClient.tsx",
        "src/components/PodcastArchiveClient.tsx",
        "src/components/WorkingToolHubClient.tsx",
        "src/components/FailureModeHubClient.tsx",
        "src/components/SiteHeader.tsx",
        "src/components/SiteFooter.tsx",
        "src/components/SystemStatusClient.tsx",
        "src/components/PersistentAudioPlayer.tsx",
        "src/components/MasonicEngravings.tsx",
        "src/app/page.tsx",
        "src/app/incidents/[slug]/page.tsx",
        "src/app/tools/[slug]/page.tsx",
        "src/app/failures/[slug]/page.tsx",
        "src/app/knowledge-graph/page.tsx",
        "src/app/archive/page.tsx",
        "src/app/podcast/page.tsx",
        "src/app/rubric/page.tsx",
        "src/app/status/page.tsx",
        "src/app/feeds/page.tsx",
        "src/app/about/page.tsx"
    )

    $bannedPublicUiPatterns = @(
        @{ Label = "TELEMETRY SPEC SHEET"; Pattern = "TELEMETRY SPEC SHEET" },
        @{ Label = "EDITORIAL DISPATCH LEDGER"; Pattern = "EDITORIAL DISPATCH LEDGER" },
        @{ Label = "POST-INCIDENT REVIEW (PIR)"; Pattern = "POST-INCIDENT REVIEW \(PIR\)" },
        @{ Label = "FACTS OF THE INCIDENT"; Pattern = "FACTS OF THE INCIDENT" },
        @{ Label = "MEDIA JITTER"; Pattern = "MEDIA JITTER" },
        @{ Label = "UNDERLYING STRUCTURAL CONSTRAINT (SIGNAL)"; Pattern = "UNDERLYING STRUCTURAL CONSTRAINT \(SIGNAL\)" },
        @{ Label = "RELATED TELEMETRY IN THE ARCHIVE"; Pattern = "RELATED TELEMETRY IN THE ARCHIVE" },
        @{ Label = "RELATED DISPATCHES IN THE ARCHIVE"; Pattern = "RELATED DISPATCHES IN THE ARCHIVE" },
        @{ Label = "Cross-Filter Signature"; Pattern = "Cross-Filter (?:Diagnostic )?Signature" },
        @{ Label = "Inspect Primary Source Dispatch / RSS Source"; Pattern = "Primary RSS Source|Inspect Primary Source Dispatch" },
        @{ Label = "Raw Enum Code (CFG-DRIFT)"; Pattern = "\(CFG-DRIFT\)" },
        @{ Label = "Raw Enum Code (CASCADE-01)"; Pattern = "\(CASCADE-01\)" },
        @{ Label = "Raw Enum Code (SIG-LOSS)"; Pattern = "\(SIG-LOSS\)" },
        @{ Label = "Raw Enum Code (SPOF-FAIL)"; Pattern = "\(SPOF-FAIL\)" },
        @{ Label = "Raw Enum Code (BLAME-ISO)"; Pattern = "\(BLAME-ISO\)" },
        @{ Label = "Raw Enum Code (INST-DEBT)"; Pattern = "\(INST-DEBT\)" },
        @{ Label = "Mystery-Meat [?] Badge"; Pattern = "\[\?\]" },
        @{ Label = "Public Feed Mutation Call (/api/cron/*)"; Pattern = "/api/cron/(?:ingest|weekly-rollup)" },
        @{ Label = "Public Feed Mutation Button"; Pattern = "Poll Sourced Publications|Submit Event for Structural Inspection|Synthesize New Friday 5-Min CAB Brief" }
    )

    foreach ($rule in $bannedPublicUiPatterns) {
        $matchesFound = Select-String -LiteralPath $publicComponentAndRouteFiles -Pattern $rule.Pattern
        if ($null -ne $matchesFound -and $matchesFound.Count -gt 0) {
            Write-Error "Test-PublicLexiconAndUsability FAILED: Found banned public UI pattern '$($rule.Label)':"
            $matchesFound | ForEach-Object {
                Write-Host "  $($_.Path):$($_.LineNumber): $($_.Line.Trim())" -ForegroundColor Red
            }
            exit 1
        }
    }
    Write-Host "  -> Zero banned UI strings, raw enum codes, or mystery-meat [?] badges across $($publicComponentAndRouteFiles.Count) public files." -ForegroundColor Green

    # Verify Krug "You Are Here" Navigation Street Signs in SiteHeader.tsx
    $siteHeaderContent = Get-Content -LiteralPath "src/components/SiteHeader.tsx" -Raw
    $requiredHeaderSnippets = @(
        "isNavItemActive",
        "/incidents/",
        'aria-current={isActive ? "page" : undefined}',
        "border-b-2 border-b-[#C5A059]",
        "font-bold"
    )
    foreach ($snippet in $requiredHeaderSnippets) {
        if (-not $siteHeaderContent.Contains($snippet)) {
            Write-Error "Test-PublicLexiconAndUsability FAILED: src/components/SiteHeader.tsx is missing required Krug navigation landmark: $snippet"
            exit 1
        }
    }
    Write-Host "  -> Krug 'You Are Here' navigation street signs (aria-current='page' & gold bottom border) verified in SiteHeader.tsx." -ForegroundColor Green

    # Verify Craft Lexicon Landmarks & Sidebar Visual Hierarchy in IncidentBriefClient.tsx
    $briefContent = Get-Content -LiteralPath "src/components/IncidentBriefClient.tsx" -Raw
    $requiredBriefSnippets = @(
        "THE CRAFTSMAN&apos;S BRIEF",
        "CASE LEDGER",
        "STRUCTURAL INSPECTION",
        "I. WHAT HAPPENED (THE PLAIN FACTS)",
        "PARTISAN HEAT &amp; SPIN (THE NOISE)",
        "THE ACTUAL FOUNDATION (THE SIGNAL)",
        "RELATED CASES ON THE TRESTLEBOARD",
        "Read Original {friendlySourceName} Article",
        "More '`${incident.primaryTool}' Cases",
        "See Similar Cases",
        "deduplicateSignalAgainstFacts"
    )
    foreach ($snippet in $requiredBriefSnippets) {
        if (-not $briefContent.Contains($snippet)) {
            Write-Error "Test-PublicLexiconAndUsability FAILED: src/components/IncidentBriefClient.tsx is missing required Craft/Krug landmark: $snippet"
            exit 1
        }
    }

    $asideStart = $briefContent.IndexOf("<aside")
    $asideEnd = $briefContent.IndexOf("</aside>")
    if ($asideStart -lt 0 -or $asideEnd -le $asideStart) {
        Write-Error "Test-PublicLexiconAndUsability FAILED: Could not locate <aside> sidebar in src/components/IncidentBriefClient.tsx"
        exit 1
    }
    $asideMarkup = $briefContent.Substring($asideStart, $asideEnd - $asideStart)
    $primaryToolIdx = $asideMarkup.IndexOf("{incident.primaryTool}")
    $failureTitleIdx = $asideMarkup.IndexOf("{failureSpec.craftTitle}")
    $engravingIdx = $asideMarkup.IndexOf("<WorkingToolEngraving")
    $ledgerIdIdx = $asideMarkup.IndexOf("{ledgerEntryLabel}")

    if ($primaryToolIdx -lt 0 -or $failureTitleIdx -lt 0 -or $engravingIdx -lt 0 -or $ledgerIdIdx -lt 0) {
        Write-Error "Test-PublicLexiconAndUsability FAILED: Sidebar (<aside>) is missing Primary Working Tool, Failure Mode, Engraving, or Ledger ID."
        exit 1
    }
    if (-not ($primaryToolIdx -lt $ledgerIdIdx -and $failureTitleIdx -lt $ledgerIdIdx -and $engravingIdx -lt $ledgerIdIdx)) {
        Write-Error "Test-PublicLexiconAndUsability FAILED: Sidebar visual hierarchy inverted -- Primary Working Tool, Failure Mode, and Engraving must precede demoted Ledger Entry ID."
        exit 1
    }
    Write-Host "  -> Sidebar visual hierarchy verified (Primary Working Tool + Failure Mode + Engraving lead; Ledger ID demoted to colophon)." -ForegroundColor Green
}

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " THE CAB CALL // DEFENSIVE HARDENING POWERSHELL TEST HARNESS" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

Write-Host "`n[Step 1/4] Running TypeScript strict compiler check (npx tsc --noEmit)..." -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Error "TypeScript compilation check failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}
Write-Host "  -> TypeScript check passed with zero errors." -ForegroundColor Green

Write-Host "`n[Step 2/4] Auditing src/ for forbidden 'SELECT *' pass-through queries..." -ForegroundColor Yellow
$selectStarMatches = Get-ChildItem -Path "src" -Recurse -Include *.ts,*.tsx | Select-String -Pattern "SELECT\s+\*\s+FROM"
if ($null -ne $selectStarMatches -and $selectStarMatches.Count -gt 0) {
    Write-Error "Found forbidden 'SELECT * FROM' queries in src/:"
    $selectStarMatches | ForEach-Object { Write-Host $_.Line -ForegroundColor Red }
    exit 1
}
Write-Host "  -> Zero 'SELECT *' queries found across src/." -ForegroundColor Green

Test-PublicLexiconAndUsability

Write-Host "`n[Step 4/4] Executing automated defensive hardening & usability verification suite..." -ForegroundColor Yellow
node --import ./scripts/register-ts-resolver.mjs scripts/verify-defensive-hardening.ts
if ($LASTEXITCODE -ne 0) {
    Write-Error "Defensive hardening verification suite failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host " ALL DEFENSIVE HARDENING & KRUG USABILITY CHECKS PASSED (100%)" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
exit 0
