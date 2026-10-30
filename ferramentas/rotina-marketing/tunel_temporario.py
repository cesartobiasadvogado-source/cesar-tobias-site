"""Endereco publico TEMPORARIO para UM arquivo do seu computador (para o Metricool baixar na hora de agendar).

Sobe um servidor local que entrega so aquele arquivo, num caminho com codigo aleatorio, e abre um tunel
rapido do cloudflared (sem conta, sem custo). Ao sair do bloco `with`, o tunel e o servidor fecham: o
arquivo deixa de estar acessivel. Nada e enviado para nuvem nenhuma, so servido enquanto o bloco esta aberto.

    with TunelTemporario('C:/.../video.mp4') as url:
        ...agendar usando `url`...
"""
import http.server
import os
import re
import secrets
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PADRAO_URL = re.compile(r'https://[a-z0-9-]+\.trycloudflare\.com')


class ErroTunel(RuntimeError):
    pass


def nome_publico(arquivo):
    """Nome simples (ASCII) para o final do endereco: o Metricool olha a extensao para saber o tipo."""
    sufixo = Path(arquivo).suffix.lower() or '.bin'
    return 'video' + sufixo


def montar_servidor(arquivo, token):
    """Servidor HTTP que entrega EXATAMENTE `/<token>/<nome>` e mais nada (404 no resto, sem listar pasta)."""
    arquivo = Path(arquivo)
    caminho_ok = '/%s/%s' % (token, nome_publico(arquivo))
    tipos = {'.mp4': 'video/mp4', '.mov': 'video/quicktime', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png'}

    class Entrega(http.server.BaseHTTPRequestHandler):
        def _cabecalho(self, codigo=200):
            self.send_response(codigo)
            self.send_header('Content-Type', tipos.get(arquivo.suffix.lower(), 'application/octet-stream'))
            self.send_header('Content-Length', str(arquivo.stat().st_size))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()

        def do_HEAD(self):
            if urllib.parse.unquote(self.path.split('?')[0]) != caminho_ok:
                self.send_error(404)
                return
            self._cabecalho()

        def do_GET(self):
            if urllib.parse.unquote(self.path.split('?')[0]) != caminho_ok:
                self.send_error(404)
                return
            self._cabecalho()
            with open(arquivo, 'rb') as f:
                shutil.copyfileobj(f, self.wfile, 256 * 1024)

        def log_message(self, *a):
            pass

    servidor = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Entrega)
    return servidor, caminho_ok


class TunelTemporario:
    def __init__(self, arquivo, cloudflared=None, tempo_limite=45, verificar_publico=True, espera_publica=90):
        self.arquivo = Path(arquivo)
        if not self.arquivo.is_file():
            raise ErroTunel('arquivo nao encontrado: %s' % arquivo)
        self.cloudflared = cloudflared or shutil.which('cloudflared')
        if not self.cloudflared:
            raise ErroTunel('cloudflared nao esta instalado (winget install Cloudflare.cloudflared)')
        self.tempo_limite = tempo_limite
        self.verificar_publico, self.espera_publica = verificar_publico, espera_publica
        self._servidor = self._proc = None

    def __enter__(self):
        token = secrets.token_urlsafe(24)
        self._servidor, caminho = montar_servidor(self.arquivo, token)
        threading.Thread(target=self._servidor.serve_forever, daemon=True).start()
        porta = self._servidor.server_address[1]
        base = list(self.cloudflared) if isinstance(self.cloudflared, (list, tuple)) else [self.cloudflared]
        self._proc = subprocess.Popen(
            base + ['tunnel', '--url', 'http://127.0.0.1:%d' % porta, '--no-autoupdate'],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
        achada = []

        def ler():
            for linha in self._proc.stdout:
                m = PADRAO_URL.search(linha)
                if m and not achada:
                    achada.append(m.group(0))

        threading.Thread(target=ler, daemon=True).start()
        fim = time.time() + self.tempo_limite
        while not achada and time.time() < fim and self._proc.poll() is None:
            time.sleep(0.2)
        if not achada:
            self.__exit__(None, None, None)
            raise ErroTunel('o cloudflared nao devolveu o endereco do tunel a tempo')
        url = achada[0] + caminho
        if self.verificar_publico:
            try:
                self._esperar_publico(url)
            except Exception:
                self.__exit__(None, None, None)
                raise
        return url

    def _esperar_publico(self, url):
        """A Cloudflare leva alguns segundos para publicar o nome de um tunel novo. So devolve o endereco
        quando ele ja responde pela internet (senao o Metricool tentaria cedo demais e falharia)."""
        fim = time.time() + self.espera_publica
        ultimo = None
        while time.time() < fim:
            try:
                req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'vero-rotina'})
                with urllib.request.urlopen(req, timeout=15) as r:
                    if r.status == 200:
                        return
            except urllib.error.HTTPError as e:
                ultimo = 'HTTP %d' % e.code
            except Exception as e:
                ultimo = type(e).__name__
            time.sleep(2)
        raise ErroTunel('o endereco do tunel nao ficou acessivel pela internet em %ds (%s)' % (self.espera_publica, ultimo))

    def __exit__(self, *exc):
        if self._proc is not None:
            try:
                self._proc.terminate()
                self._proc.wait(timeout=10)
            except Exception:
                try:
                    self._proc.kill()
                except Exception:
                    pass
            try:
                self._proc.stdout.close()
            except Exception:
                pass
            self._proc = None
        if self._servidor is not None:
            self._servidor.shutdown()
            self._servidor.server_close()
            self._servidor = None
        return False
