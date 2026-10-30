"""Teste de ponta a ponta SEM PUBLICAR: cria UM RASCUNHO no Metricool com o video escolhido.

Abre o tunel temporario do video, pede ao Metricool um rascunho (draft, sem publicacao automatica, data em
2027, so Instagram) e fecha o tunel. O rascunho fica no planner do Metricool para voce ver e apagar.

Uso:  python testar_rascunho_metricool.py "C:\\caminho\\video_editado.mp4" [ID_DA_MARCA]
"""
import json
import sys

import requests

import metricool_mcp as mm
import tunel_temporario as tt

MARCA_PADRAO = '6492833'   # "Cesar Tobias Advocacia"


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    video, marca = argv[1], (argv[2] if len(argv) > 2 else MARCA_PADRAO)
    oauth = mm.OAuth(requests, mm.Cofre())
    cliente = mm.ClienteMcp(oauth, requests)
    cliente.iniciar()
    print('conectado ao Metricool; abrindo o tunel temporario (leva ~1 min)...')
    with tt.TunelTemporario(video) as url:
        print('endereco temporario no ar; pedindo o rascunho ao Metricool...')
        info = {'autoPublish': False, 'draft': True, 'descendants': [], 'hasNotReadNotes': False, 'firstCommentText': '',
                'media': [url], 'mediaAltText': [], 'providers': [{'network': 'instagram'}],
                'publicationDate': {'dateTime': '2027-01-15T18:30:00', 'timezone': 'America/Fortaleza'},
                'shortener': False, 'smartLinkData': {'ids': []},
                'text': 'TESTE DE INTEGRACAO DA ROTINA - RASCUNHO - NAO PUBLICAR. Pode apagar.',
                'instagramData': {'type': 'REEL'}}
        resposta = cliente.chamar('createScheduledPost', {'blogId': marca, 'date': '2027-01-15T18:30:00-03:00', 'info': json.dumps(info)})
    print('tunel fechado.')
    dados = resposta.get('data', resposta) if isinstance(resposta, dict) else {}
    print('rascunho criado: id', dados.get('id'), '| draft:', dados.get('draft'), '| autoPublish:', dados.get('autoPublish'))
    print('video guardado pelo Metricool em:', dados.get('media'))
    print('ver/apagar no planner:', dados.get('plannerUrl'))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
