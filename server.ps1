# Kleiner Webserver nur zum Testen (nicht fuer die echte Veroeffentlichung).
# Start:  powershell -ExecutionPolicy Bypass -File server.ps1
# Dann am PC:    http://localhost:8080
# Am Handy (gleiches WLAN): http://<IP-des-PCs>:8080  (die IP wird beim Start angezeigt)
param([int]$Port = 8080)

$root = $PSScriptRoot
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'; '.png' = 'image/png'
  '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.md' = 'text/plain; charset=utf-8'
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$listener.Start()
Write-Host "Server laeuft auf Port $Port. Beenden mit Strg+C."
Write-Host "Am PC:    http://localhost:$Port"
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  ForEach-Object { Write-Host "Am Handy: http://$($_.IPAddress):$Port" }

# Browser oeffnen oft Verbindungen "auf Vorrat", ohne gleich etwas zu senden.
# Deshalb warten wir nicht auf eine einzelne Verbindung, sondern bedienen die, die Daten geschickt haben.
$wartend = [System.Collections.ArrayList]::new()
while ($true) {
  while ($listener.Pending()) { [void]$wartend.Add(@{ c = $listener.AcceptTcpClient(); t = [DateTime]::Now }) }
  $bereit = @($wartend | Where-Object { $_.c.Available -gt 0 -or ([DateTime]::Now - $_.t).TotalSeconds -gt 15 })
  if (-not $bereit) { Start-Sleep -Milliseconds 10; continue }
  foreach ($w in $bereit) { $wartend.Remove($w) }
  foreach ($w in $bereit) {
  $client = $w.c
  try {
    if ($client.Available -eq 0) { continue }
    $stream = $client.GetStream()
    $stream.ReadTimeout = 2000
    $reader = [System.IO.StreamReader]::new($stream)
    $line = $reader.ReadLine()
    while (($h = $reader.ReadLine()) -ne $null -and $h -ne '') { }
    if (-not $line) { continue }
    $path = ($line -split ' ')[1]
    $path = [System.Uri]::UnescapeDataString(($path -split '\?')[0])
    if ($path.EndsWith('/')) { $path += 'index.html' }
    $file = [System.IO.Path]::GetFullPath((Join-Path $root $path.TrimStart('/')))
    if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
      $body = [System.IO.File]::ReadAllBytes($file)
      $type = $mime[[System.IO.Path]::GetExtension($file).ToLower()]
      if (-not $type) { $type = 'application/octet-stream' }
      $status = '200 OK'
    } else {
      $body = [System.Text.Encoding]::UTF8.GetBytes('Nicht gefunden')
      $type = 'text/plain; charset=utf-8'; $status = '404 Not Found'
    }
    $head = "HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    $stream.Write($body, 0, $body.Length)
    Write-Host "$status $path"
  } catch {
    Write-Host "Fehler: $_"
  } finally {
    $client.Close()
  }
  }
}
