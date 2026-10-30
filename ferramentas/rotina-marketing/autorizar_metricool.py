"""Autoriza a rotina a programar posts no seu Metricool. Rode UMA vez:  python autorizar_metricool.py

Abre o navegador na pagina de login do Metricool; voce clica em Autorizar. Os tokens ficam no COFRE DO
WINDOWS (Gerenciador de Credenciais, "vero-metricool"), nunca em arquivo e nunca na tela.
Para revogar depois: nas configuracoes do Metricool (apps/conexoes autorizadas) ou apagando a credencial
"vero-metricool" no Gerenciador de Credenciais do Windows."""
import sys

import requests

import metricool_mcp as mm


def main():
    oauth = mm.OAuth(requests, mm.Cofre())
    print('Vou abrir o navegador. No Metricool, entre com a sua conta e clique em AUTORIZAR.')
    print('(Se nada abrir em alguns segundos, copie o endereco que aparecer no terminal.)')
    try:
        oauth.autorizar(tempo_limite=300)
    except mm.ErroMetricool as e:
        print('NAO autorizado: %s' % e)
        return 1
    cliente = mm.ClienteMcp(oauth, requests)
    cliente.iniciar()
    ferramentas = cliente.ferramentas()
    print('Autorizado e conectado. %d ferramentas disponiveis no Metricool.' % len(ferramentas))
    print('Pode agendar posts:', 'createScheduledPost' in ferramentas)
    return 0


if __name__ == '__main__':
    sys.exit(main())
