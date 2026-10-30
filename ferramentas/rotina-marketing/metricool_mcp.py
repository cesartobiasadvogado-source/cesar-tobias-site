"""Cliente minimo do MCP do Metricool (https://ai.metricool.com/mcp) para a rotina agendar posts.

Fala o mesmo protocolo que o Claude, o Make e o Zapier usam: login OAuth 2.1 com PKCE e registro
dinamico de cliente (uma unica autorizacao no navegador), depois chamadas JSON-RPC. Os tokens ficam no
cofre do Windows (keyring), nunca em arquivo nem na tela. So usa o que o plano Free permite (o MCP).

Uso (uma vez):  python autorizar_metricool.py
"""
import base64
import hashlib
import http.server
import json
import secrets
import threading
import time
import urllib.parse
import webbrowser

MCP_URL = 'https://ai.metricool.com/mcp'
META_URL = 'https://ai.metricool.com/.well-known/oauth-authorization-server'
SERVICO = 'vero-metricool'
CHAVE = 'oauth'
ESCOPOS = 'mcp:read mcp:write'
NOME_CLIENTE = 'Vero Juridico - rotina de marketing'


class ErroMetricool(RuntimeError):
    pass


class RecusaMetricool(ErroMetricool):
    """O Metricool respondeu e RECUSOU a ferramenta (isError): nada foi criado. Diferente de falha de rede,
    em que nao da para saber se o post chegou a ser criado."""


def _b64url(dados):
    return base64.urlsafe_b64encode(dados).rstrip(b'=').decode('ascii')


def pkce_par():
    """(verifier, challenge S256) do PKCE."""
    verifier = _b64url(secrets.token_bytes(48))
    return verifier, _b64url(hashlib.sha256(verifier.encode('ascii')).digest())


def url_de_autorizacao(meta, client_id, redirect_uri, challenge, state):
    params = {'response_type': 'code', 'client_id': client_id, 'redirect_uri': redirect_uri,
              'code_challenge': challenge, 'code_challenge_method': 'S256', 'scope': ESCOPOS, 'state': state,
              'resource': MCP_URL}
    return meta['authorization_endpoint'] + '?' + urllib.parse.urlencode(params)


def ler_resposta_mcp(texto, tipo_conteudo):
    """O servidor responde JSON puro ou SSE (`data: {...}`); devolve o ultimo objeto JSON-RPC com resultado/erro."""
    if 'text/event-stream' not in (tipo_conteudo or ''):
        return json.loads(texto)
    ultimo = None
    for linha in texto.splitlines():
        if linha.startswith('data:'):
            carga = linha[5:].strip()
            if carga:
                try:
                    obj = json.loads(carga)
                except ValueError:
                    continue
                if 'result' in obj or 'error' in obj:
                    ultimo = obj
    if ultimo is None:
        raise ErroMetricool('resposta do Metricool sem resultado')
    return ultimo


class Cofre:
    """Guarda/le o JSON dos tokens no keyring. Troque nos testes por um falso."""

    def __init__(self, keyring_mod=None):
        if keyring_mod is None:
            import keyring as keyring_mod
        self.k = keyring_mod

    def ler(self):
        bruto = self.k.get_password(SERVICO, CHAVE)
        return json.loads(bruto) if bruto else None

    def gravar(self, dados):
        self.k.set_password(SERVICO, CHAVE, json.dumps(dados))


class OAuth:
    def __init__(self, http, cofre, agora=time.time):
        self.http, self.cofre, self.agora = http, cofre, agora

    def metadados(self):
        r = self.http.get(META_URL, timeout=30)
        r.raise_for_status()
        return r.json()

    def registrar_cliente(self, meta, redirect_uri):
        r = self.http.post(meta['registration_endpoint'], json={
            'client_name': NOME_CLIENTE, 'redirect_uris': [redirect_uri], 'grant_types': ['authorization_code', 'refresh_token'],
            'response_types': ['code'], 'token_endpoint_auth_method': 'none', 'scope': ESCOPOS}, timeout=30)
        if r.status_code >= 400:
            raise ErroMetricool('Metricool recusou o cadastro do cliente (%d): %s' % (r.status_code, r.text[:200]))
        return r.json()['client_id']

    def _guardar(self, dados_token, client_id, meta):
        atual = self.cofre.ler() or {}
        self.cofre.gravar({
            'client_id': client_id, 'token_endpoint': meta['token_endpoint'],
            'access_token': dados_token['access_token'],
            'refresh_token': dados_token.get('refresh_token') or atual.get('refresh_token'),
            'expira_em': self.agora() + int(dados_token.get('expires_in', 3600)),
        })

    def autorizar(self, abrir=webbrowser.open, tempo_limite=240, porta=0):
        """Fluxo completo no navegador: devolve quando o codigo chegou e os tokens foram guardados."""
        meta = self.metadados()
        resultado = {}

        class Retorno(http.server.BaseHTTPRequestHandler):
            def do_GET(self_):
                q = urllib.parse.parse_qs(urllib.parse.urlparse(self_.path).query)
                resultado.update({k: v[0] for k, v in q.items()})
                self_.send_response(200)
                self_.send_header('Content-Type', 'text/html; charset=utf-8')
                self_.end_headers()
                self_.wfile.write('<html><body style="font-family:sans-serif"><h3>Autorizado.</h3>'
                                  '<p>Pode fechar esta aba e voltar ao terminal.</p></body></html>'.encode('utf-8'))

            def log_message(self_, *a):
                pass

        servidor = http.server.HTTPServer(('127.0.0.1', porta), Retorno)
        redirect_uri = 'http://127.0.0.1:%d/callback' % servidor.server_address[1]
        client_id = self.registrar_cliente(meta, redirect_uri)
        verifier, challenge = pkce_par()
        state = secrets.token_urlsafe(16)
        threading.Thread(target=servidor.serve_forever, daemon=True).start()
        try:
            abrir(url_de_autorizacao(meta, client_id, redirect_uri, challenge, state))
            fim = self.agora() + tempo_limite
            while 'code' not in resultado and 'error' not in resultado and self.agora() < fim:
                time.sleep(0.3)
        finally:
            servidor.shutdown()
        if 'error' in resultado:
            raise ErroMetricool('autorizacao recusada: ' + resultado['error'])
        if 'code' not in resultado:
            raise ErroMetricool('tempo esgotado esperando a autorizacao no navegador')
        if resultado.get('state') != state:
            raise ErroMetricool('resposta de autorizacao com "state" diferente: abortado por seguranca')
        r = self.http.post(meta['token_endpoint'], data={
            'grant_type': 'authorization_code', 'code': resultado['code'], 'redirect_uri': redirect_uri,
            'client_id': client_id, 'code_verifier': verifier, 'resource': MCP_URL}, timeout=30)
        if r.status_code >= 400:
            raise ErroMetricool('Metricool recusou a troca do codigo (%d): %s' % (r.status_code, r.text[:200]))
        self._guardar(r.json(), client_id, meta)

    def token_valido(self):
        dados = self.cofre.ler()
        if not dados:
            raise ErroMetricool('Metricool ainda nao autorizado: rode autorizar_metricool.py')
        if dados['expira_em'] - self.agora() > 60:
            return dados['access_token']
        if not dados.get('refresh_token'):
            raise ErroMetricool('sessao do Metricool expirou e nao ha renovacao: rode autorizar_metricool.py de novo')
        r = self.http.post(dados['token_endpoint'], data={
            'grant_type': 'refresh_token', 'refresh_token': dados['refresh_token'], 'client_id': dados['client_id'],
            'resource': MCP_URL}, timeout=30)
        if r.status_code >= 400:
            raise ErroMetricool('nao consegui renovar o acesso ao Metricool (%d): rode autorizar_metricool.py de novo' % r.status_code)
        self._guardar(r.json(), dados['client_id'], {'token_endpoint': dados['token_endpoint']})
        return self.cofre.ler()['access_token']


class ClienteMcp:
    def __init__(self, oauth, http):
        self.oauth, self.http = oauth, http
        self._sessao, self._id = None, 0

    def _enviar(self, corpo):
        cab = {'Authorization': 'Bearer ' + self.oauth.token_valido(), 'Content-Type': 'application/json',
               'Accept': 'application/json, text/event-stream'}
        if self._sessao:
            cab['Mcp-Session-Id'] = self._sessao
        r = self.http.post(MCP_URL, json=corpo, headers=cab, timeout=120)
        if r.status_code == 401:
            raise ErroMetricool('Metricool recusou o acesso (401): rode autorizar_metricool.py de novo')
        if r.status_code >= 400:
            raise ErroMetricool('Metricool respondeu %d: %s' % (r.status_code, r.text[:200]))
        if r.headers.get('Mcp-Session-Id'):
            self._sessao = r.headers['Mcp-Session-Id']
        return r

    def _chamar(self, metodo, params=None):
        self._id += 1
        r = self._enviar({'jsonrpc': '2.0', 'id': self._id, 'method': metodo, 'params': params or {}})
        resposta = ler_resposta_mcp(r.text, r.headers.get('Content-Type'))
        if 'error' in resposta:
            raise ErroMetricool('erro do Metricool: ' + json.dumps(resposta['error'], ensure_ascii=False)[:300])
        return resposta['result']

    def iniciar(self):
        self._chamar('initialize', {'protocolVersion': '2025-03-26', 'capabilities': {},
                                    'clientInfo': {'name': 'vero-rotina-marketing', 'version': '1.0'}})
        self._enviar({'jsonrpc': '2.0', 'method': 'notifications/initialized'})

    def ferramentas(self):
        return [t['name'] for t in self._chamar('tools/list').get('tools', [])]

    def chamar(self, ferramenta, argumentos):
        """Chama uma ferramenta e devolve o conteudo (JSON ja lido quando o texto for JSON)."""
        resultado = self._chamar('tools/call', {'name': ferramenta, 'arguments': argumentos})
        texto = ''.join(c.get('text', '') for c in resultado.get('content', []) if c.get('type') == 'text')
        if resultado.get('isError'):
            raise RecusaMetricool('o Metricool recusou: ' + texto[:400])
        try:
            return json.loads(texto)
        except ValueError:
            return texto
