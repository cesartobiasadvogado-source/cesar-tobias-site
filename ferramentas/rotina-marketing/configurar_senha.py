"""Guarda a senha do usuario da rotina no COFRE DO WINDOWS (Gerenciador de Credenciais).
Rode voce mesmo, uma vez:  python configurar_senha.py
A senha e digitada aqui no terminal (nao aparece na tela) e nunca vai para arquivo nem para o chat."""
import getpass
import json
import sys
from pathlib import Path

import keyring

SERVICO = 'vero-rotina-marketing'


def main():
    config = json.loads(Path(__file__).with_name('config.json').read_text(encoding='utf-8'))
    usuario = config['usuario']
    print('Usuario da rotina: ' + usuario)
    senha = getpass.getpass('Senha desse usuario no painel: ')
    if not senha or senha != getpass.getpass('Repita a senha: '):
        print('As senhas nao conferem ou estao vazias. Nada foi salvo.')
        return 1
    keyring.set_password(SERVICO, usuario, senha)
    print('Pronto: senha guardada no cofre do Windows.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
