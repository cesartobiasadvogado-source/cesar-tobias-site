"""Vigia do Metricool: fica ligado no seu computador e, a cada ~30 s, olha o painel. Quando voce clica em
"Enviar ao Metricool agora" num cartao, ele cria o post no Metricool em ~1 minuto (sem esperar a rotina).

Nao edita video, nao escreve legenda e nao decide nada: so executa o que voce ja aprovou no painel, com as
mesmas regras da rotina (publicar_metricool.py): nunca duplica, nunca repete erro sozinho, recusa horario
a menos de 15 min. Use:  python vigia_metricool.py   (ou deixe o Agendador abrir ao entrar no Windows).
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

import publicar_metricool as pm
import rotina_marketing as rm
import tunel_temporario as tt

INTERVALO_S = 30
RELOGIN_S = 20 * 60


def um_ciclo(painel, config, fabrica_metricool, tunel=tt.TunelTemporario, agora=time.time, log=print):
    """Uma olhada no painel. Devolve a lista do que foi feito (vazia quando nao havia nada a enviar)."""
    cfg = pm.configurar(config)
    if not cfg['ativo']:
        return []
    base = Path(config['pasta_base'])
    atuais = painel.listar('agendado')
    # nem pega a trava nem abre o Metricool se nenhum cartao pediu envio
    if not any((c.get('publicacao') or {}).get('programar') and not ((c.get('publicacao') or {}).get('metricool') or {}).get('status')
               or ((c.get('publicacao') or {}).get('metricool') or {}).get('status') == 'enviando' for c in atuais):
        return []
    with pm.trava_programacao(base / '_rotina', agora=agora) as pegou:
        if not pegou:
            return []
        programador = pm.Programador(painel, fabrica_metricool, tunel, cfg, base / '2-Editados', agora, log=log)
        return pm.programar_pendentes(programador, atuais)


def _novo_painel(config):
    import keyring
    import requests
    senha = keyring.get_password('vero-rotina-marketing', config['usuario'])
    if not senha:
        raise RuntimeError('senha da rotina nao cadastrada. Rode configurar_senha.py')
    p = rm.Painel(config['url_painel'], config['usuario'], senha, requests)
    p.entrar()
    return p


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--config', default=str(Path(__file__).with_name('config.json')))
    ap.add_argument('--uma-vez', action='store_true', help='faz uma olhada so e sai (para teste)')
    a = ap.parse_args(argv)
    config = json.loads(Path(a.config).read_text(encoding='utf-8'))
    fabrica = rm.fabrica_metricool()
    painel, entrou_em = None, 0
    while True:
        try:
            if painel is None or time.time() - entrou_em > RELOGIN_S:
                painel, entrou_em = _novo_painel(config), time.time()
            feitos = um_ciclo(painel, config, fabrica)
            for f in feitos:
                print(time.strftime('%H:%M:%S'), json.dumps(f, ensure_ascii=False), flush=True)
        except Exception as e:  # nunca morre por causa de internet fora do ar ou painel fora do ar
            print(time.strftime('%H:%M:%S'), 'aviso:', str(e)[:200], flush=True)
            painel = None
        if a.uma_vez:
            return 0
        time.sleep(INTERVALO_S)


if __name__ == '__main__':
    sys.exit(main())
