# Liga o vigia do Metricool: abre sozinho quando voce entra no Windows e fica rodando escondido.
# Pode rodar de novo a qualquer hora: recria a tarefa no lugar da anterior.
#   powershell -ExecutionPolicy Bypass -File agendar_vigia.ps1            (cria e liga agora)
#   powershell -ExecutionPolicy Bypass -File agendar_vigia.ps1 -Remover   (desliga e apaga a tarefa)
param([switch]$Remover)

$nome = 'Vero - Vigia Metricool'
if ($Remover) {
    Stop-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $nome -Confirm:$false
    Write-Output "Tarefa '$nome' removida."
    exit 0
}

$pasta = $PSScriptRoot
# pythonw = Python sem janela preta; o Python de VERDADE, nao o atalho da Microsoft Store
$python = (& python -c "import sys, os; print(os.path.join(os.path.dirname(sys.executable), 'pythonw.exe'))").Trim()
$acao = New-ScheduledTaskAction -Execute $python -Argument "vigia_metricool.py" -WorkingDirectory $pasta
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
# uma so copia; se cair, o Windows reabre em 1 minuto (ate 99 vezes); sem limite de tempo
$config = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
    -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $config -Principal $principal -Force `
    -Description 'Olha o painel a cada 30 s e envia ao Metricool os posts que voce mandou enviar (nao edita nem posta sozinho).' | Out-Null
Start-ScheduledTask -TaskName $nome
Write-Output "Tarefa '$nome' criada e ligada: abre sozinha ao entrar no Windows."
