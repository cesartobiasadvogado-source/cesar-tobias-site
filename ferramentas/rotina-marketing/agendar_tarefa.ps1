# Cria no Agendador de Tarefas do Windows a rotina do marketing, 2x por dia (08:30 e 17:30).
# Pode rodar de novo a qualquer hora: recria a tarefa no lugar da anterior.
#   powershell -ExecutionPolicy Bypass -File agendar_tarefa.ps1            (cria)
#   powershell -ExecutionPolicy Bypass -File agendar_tarefa.ps1 -Remover   (desliga e apaga a tarefa)
param([switch]$Remover)

$nome = 'Vero - Rotina Marketing'
if ($Remover) {
    Unregister-ScheduledTask -TaskName $nome -Confirm:$false
    Write-Output "Tarefa '$nome' removida."
    exit 0
}

$pasta = $PSScriptRoot
# o Python de VERDADE, nao o atalho da Microsoft Store (WindowsApps), que as vezes falha quando o Agendador abre o programa
$python = (& python -c "import sys; print(sys.executable)").Trim()
$acao = New-ScheduledTaskAction -Execute $python -Argument "rotina_marketing.py" -WorkingDirectory $pasta
$gatilhos = @(
    (New-ScheduledTaskTrigger -Daily -At '08:30'),
    (New-ScheduledTaskTrigger -Daily -At '17:30')
)
# so roda com o usuario logado (precisa da unidade H: do Drive e do cofre de senhas do Windows);
# se o computador estava desligado na hora, roda assim que ligar; nunca duas ao mesmo tempo.
$config = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilhos -Settings $config -Principal $principal -Force `
    -Description 'Edita os videos novos de 1-Brutos e prepara o agendamento no painel (nao posta nada).' | Out-Null
Write-Output "Tarefa '$nome' criada: todo dia as 08:30 e 17:30."
