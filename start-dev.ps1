param(
  [string]$ServerProject = "src/GestorGanadero.Server/GestorGanadero.Server.csproj",
  [string]$ClientProject = "src/GestorGanadero.Client/GestorGanadero.Client.csproj",
  [int]$ServerPort = 5073
)

Write-Host "Starting server (gRPC) on port $ServerPort..." -ForegroundColor Green
$server = Start-Process -FilePath "dotnet" -ArgumentList @("run", "--project", $ServerProject, "--urls", "http://localhost:$ServerPort") -NoNewWindow -RedirectStandardOutput server.log -RedirectStandardError server.log -PassThru

Write-Host "Waiting for server to be ready..." -ForegroundColor Yellow
while (-not (Test-NetConnection -ComputerName localhost -Port $ServerPort -InformationLevel Quiet)) {
  Start-Sleep -Seconds 1
}
Write-Host "Server ready." -ForegroundColor Green

Write-Host "Starting client Blazor WASM..." -ForegroundColor Green
$client = Start-Process -FilePath "dotnet" -ArgumentList @("run", "--project", $ClientProject) -NoNewWindow -RedirectStandardOutput client.log -RedirectStandardError client.log -PassThru

Write-Host "Dev environment running. Server: PID $($server.Id), Client: PID $($client.Id)" -ForegroundColor Cyan

Pause
