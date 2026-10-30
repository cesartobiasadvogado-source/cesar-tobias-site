"""Roda com (dentro da pasta): python -m unittest test_metricool -v   (sem internet, sem Metricool, sem cloudflared)"""
import hashlib
import base64
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import metricool_mcp as mm
import tunel_temporario as tt

META = {'authorization_endpoint': 'https://app.metricool.com/oauth/authorize', 'token_endpoint': 'https://app.metricool.com/oauth/token',
        'registration_endpoint': 'https://app.metricool.com/oauth/register'}


class KeyringFalso:
    def __init__(self):
        self.d = {}

    def get_password(self, servico, chave):
        return self.d.get((servico, chave))

    def set_password(self, servico, chave, valor):
        self.d[(servico, chave)] = valor


class Resp:
    def __init__(self, status=200, corpo=None, texto=None, cab=None):
        self.status_code, self._corpo, self.headers = status, corpo, cab or {'Content-Type': 'application/json'}
        self.text = texto if texto is not None else json.dumps(corpo)

    def json(self):
        return self._corpo if self._corpo is not None else json.loads(self.text)

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError('HTTP %d' % self.status_code)


class HttpFalso:
    def __init__(self, respostas=None):
        self.chamadas, self.respostas = [], dict(respostas or {})

    def _resp(self, metodo, url, kw):
        self.chamadas.append((metodo, url, kw))
        r = self.respostas.get((metodo, url))
        if callable(r):
            r = r(kw)
        return r if r is not None else Resp(404, {})

    def get(self, url, **kw):
        return self._resp('GET', url, kw)

    def post(self, url, **kw):
        return self._resp('POST', url, kw)


class Pkce(unittest.TestCase):
    def test_challenge_e_o_sha256_do_verifier(self):
        v, c = mm.pkce_par()
        esperado = base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).rstrip(b'=').decode()
        self.assertEqual(c, esperado)
        self.assertGreaterEqual(len(v), 43)
        self.assertNotEqual(mm.pkce_par()[0], v)           # nunca repete

    def test_url_de_autorizacao_leva_pkce_state_e_escopo(self):
        u = mm.url_de_autorizacao(META, 'cid', 'http://127.0.0.1:5/callback', 'CH', 'ST')
        q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)
        self.assertEqual((q['code_challenge_method'], q['state'], q['client_id']), (['S256'], ['ST'], ['cid']))
        self.assertEqual(q['scope'], ['mcp:read mcp:write'])
        self.assertTrue(u.startswith(META['authorization_endpoint'] + '?'))


class Resposta(unittest.TestCase):
    def test_json_puro(self):
        self.assertEqual(mm.ler_resposta_mcp('{"result": {"a": 1}}', 'application/json')['result'], {'a': 1})

    def test_sse_ignora_ping_e_pega_o_ultimo_resultado(self):
        sse = ': ping\n\nevent: message\ndata: {"jsonrpc":"2.0","method":"x"}\n\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n'
        self.assertEqual(mm.ler_resposta_mcp(sse, 'text/event-stream; charset=utf-8')['result'], {'ok': True})

    def test_sse_sem_resultado_e_erro(self):
        with self.assertRaises(mm.ErroMetricool):
            mm.ler_resposta_mcp(': ping\n\n', 'text/event-stream')


class Tokens(unittest.TestCase):
    def setUp(self):
        self.kr = KeyringFalso()
        self.agora = [1000.0]
        self.http = HttpFalso()
        self.oauth = mm.OAuth(self.http, mm.Cofre(self.kr), agora=lambda: self.agora[0])

    def _guardar(self, **kw):
        base = {'client_id': 'cid', 'token_endpoint': META['token_endpoint'], 'access_token': 'A1', 'refresh_token': 'R1', 'expira_em': 5000}
        base.update(kw)
        mm.Cofre(self.kr).gravar(base)

    def test_sem_autorizacao_pede_para_autorizar(self):
        with self.assertRaises(mm.ErroMetricool) as e:
            self.oauth.token_valido()
        self.assertIn('autorizar_metricool.py', str(e.exception))

    def test_token_ainda_valido_nao_vai_a_rede(self):
        self._guardar()
        self.assertEqual(self.oauth.token_valido(), 'A1')
        self.assertEqual(self.http.chamadas, [])

    def test_token_perto_de_expirar_e_renovado_e_guarda_o_novo(self):
        self._guardar(expira_em=1030)                        # falta 30 s: renova
        self.http.respostas[('POST', META['token_endpoint'])] = Resp(200, {'access_token': 'A2', 'expires_in': 3600})
        self.assertEqual(self.oauth.token_valido(), 'A2')
        corpo = self.http.chamadas[0][2]['data']
        self.assertEqual((corpo['grant_type'], corpo['refresh_token'], corpo['client_id']), ('refresh_token', 'R1', 'cid'))
        guardado = mm.Cofre(self.kr).ler()
        self.assertEqual((guardado['access_token'], guardado['refresh_token'], guardado['expira_em']), ('A2', 'R1', 1000 + 3600))

    def test_renovacao_recusada_manda_autorizar_de_novo(self):
        self._guardar(expira_em=900)
        self.http.respostas[('POST', META['token_endpoint'])] = Resp(400, {'error': 'invalid_grant'})
        with self.assertRaises(mm.ErroMetricool) as e:
            self.oauth.token_valido()
        self.assertIn('autorizar_metricool.py', str(e.exception))

    def test_expirado_sem_refresh_token_pede_nova_autorizacao(self):
        self._guardar(expira_em=900, refresh_token=None)
        with self.assertRaises(mm.ErroMetricool):
            self.oauth.token_valido()


class FluxoNoNavegador(unittest.TestCase):
    """Usa o servidor local de verdade; o 'navegador' e uma funcao que abre a URL de retorno."""

    def setUp(self):
        self.kr = KeyringFalso()
        self.http = HttpFalso({
            ('GET', mm.META_URL): Resp(200, META),
            ('POST', META['registration_endpoint']): lambda kw: Resp(201, {'client_id': 'cid-novo'}),
            ('POST', META['token_endpoint']): Resp(200, {'access_token': 'AT', 'refresh_token': 'RT', 'expires_in': 3600}),
        })
        self.oauth = mm.OAuth(self.http, mm.Cofre(self.kr))

    def _navegador(self, **sobrescrever):
        def abrir(url):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
            retorno = {'code': 'CODIGO', 'state': q['state'][0]}
            retorno.update(sobrescrever)
            alvo = q['redirect_uri'][0] + '?' + urllib.parse.urlencode(retorno)
            threading.Thread(target=lambda: urllib.request.urlopen(alvo, timeout=10).read(), daemon=True).start()
        return abrir

    def test_sucesso_troca_o_codigo_com_o_verifier_e_guarda_no_cofre(self):
        self.oauth.autorizar(abrir=self._navegador(), tempo_limite=10)
        troca = [c for c in self.http.chamadas if c[1] == META['token_endpoint']][0][2]['data']
        self.assertEqual((troca['grant_type'], troca['code'], troca['client_id']), ('authorization_code', 'CODIGO', 'cid-novo'))
        self.assertGreaterEqual(len(troca['code_verifier']), 43)
        reg = [c for c in self.http.chamadas if c[1] == META['registration_endpoint']][0][2]['json']
        self.assertEqual(reg['token_endpoint_auth_method'], 'none')                  # cliente publico, sem segredo no disco
        self.assertTrue(reg['redirect_uris'][0].startswith('http://127.0.0.1:'))
        guardado = mm.Cofre(self.kr).ler()
        self.assertEqual((guardado['access_token'], guardado['refresh_token'], guardado['client_id']), ('AT', 'RT', 'cid-novo'))

    def test_state_diferente_aborta_e_nao_guarda_nada(self):
        with self.assertRaises(mm.ErroMetricool) as e:
            self.oauth.autorizar(abrir=self._navegador(state='OUTRO'), tempo_limite=10)
        self.assertIn('state', str(e.exception))
        self.assertIsNone(mm.Cofre(self.kr).ler())
        self.assertFalse([c for c in self.http.chamadas if c[1] == META['token_endpoint']])

    def test_recusa_na_tela_do_metricool(self):
        with self.assertRaises(mm.ErroMetricool):
            self.oauth.autorizar(abrir=self._navegador(code=None, error='access_denied') if False else self._recusar(), tempo_limite=10)
        self.assertIsNone(mm.Cofre(self.kr).ler())

    def _recusar(self):
        def abrir(url):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
            alvo = q['redirect_uri'][0] + '?error=access_denied&state=' + q['state'][0]
            threading.Thread(target=lambda: urllib.request.urlopen(alvo, timeout=10).read(), daemon=True).start()
        return abrir

    def test_ninguem_clica_e_o_tempo_acaba(self):
        with self.assertRaises(mm.ErroMetricool) as e:
            self.oauth.autorizar(abrir=lambda url: None, tempo_limite=1)
        self.assertIn('tempo esgotado', str(e.exception))


class ChamadasMcp(unittest.TestCase):
    def setUp(self):
        self.kr = KeyringFalso()
        mm.Cofre(self.kr).gravar({'client_id': 'c', 'token_endpoint': 't', 'access_token': 'TOK', 'refresh_token': 'R', 'expira_em': 10 ** 12})
        self.cabs = []

        def mcp(kw):
            self.cabs.append(kw['headers'])
            corpo = kw['json']
            if corpo.get('method') == 'initialize':
                return Resp(200, {'jsonrpc': '2.0', 'id': corpo['id'], 'result': {}}, cab={'Content-Type': 'application/json', 'Mcp-Session-Id': 'SESS'})
            if corpo.get('method') == 'notifications/initialized':
                return Resp(202, {}, texto='')
            if corpo.get('method') == 'tools/call':
                nome = corpo['params']['name']
                if nome == 'falha':
                    return Resp(200, {'jsonrpc': '2.0', 'id': corpo['id'], 'result': {'isError': True, 'content': [{'type': 'text', 'text': 'sem plano'}]}})
                texto = json.dumps({'data': {'id': 7, 'echo': corpo['params']['arguments']}}) if nome != 'texto' else 'so texto'
                return Resp(200, {'jsonrpc': '2.0', 'id': corpo['id'], 'result': {'content': [{'type': 'text', 'text': texto}]}})
            return Resp(200, {'jsonrpc': '2.0', 'id': corpo['id'], 'result': {'tools': [{'name': 'createScheduledPost'}]}})

        self.http = HttpFalso({('POST', mm.MCP_URL): mcp})
        self.cliente = mm.ClienteMcp(mm.OAuth(self.http, mm.Cofre(self.kr)), self.http)

    def test_inicia_a_sessao_e_reusa_o_id_nas_chamadas_seguintes(self):
        self.cliente.iniciar()
        self.assertEqual(self.cliente.ferramentas(), ['createScheduledPost'])
        self.assertNotIn('Mcp-Session-Id', self.cabs[0])
        self.assertTrue(all(c.get('Mcp-Session-Id') == 'SESS' for c in self.cabs[1:]))
        self.assertTrue(all(c['Authorization'] == 'Bearer TOK' for c in self.cabs))

    def test_chamar_devolve_o_json_do_texto(self):
        self.cliente.iniciar()
        r = self.cliente.chamar('createScheduledPost', {'a': 1})
        self.assertEqual(r['data'], {'id': 7, 'echo': {'a': 1}})
        self.assertEqual(self.cliente.chamar('texto', {}), 'so texto')

    def test_erro_da_ferramenta_vira_excecao_clara(self):
        self.cliente.iniciar()
        with self.assertRaises(mm.ErroMetricool) as e:
            self.cliente.chamar('falha', {})
        self.assertIn('sem plano', str(e.exception))

    def test_401_manda_autorizar_de_novo(self):
        self.http.respostas[('POST', mm.MCP_URL)] = Resp(401, {})
        with self.assertRaises(mm.ErroMetricool) as e:
            self.cliente.iniciar()
        self.assertIn('autorizar_metricool.py', str(e.exception))


class ServidorDoArquivo(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.arq = self.tmp / 'Meu vídeo editado.mp4'
        self.arq.write_bytes(b'0123456789' * 1000)
        self.servidor, self.caminho = tt.montar_servidor(self.arq, 'TOKENSECRETO')
        threading.Thread(target=self.servidor.serve_forever, daemon=True).start()
        self.base = 'http://127.0.0.1:%d' % self.servidor.server_address[1]

    def tearDown(self):
        self.servidor.shutdown()
        self.servidor.server_close()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _get(self, caminho, metodo='GET'):
        return urllib.request.urlopen(urllib.request.Request(self.base + caminho, method=metodo), timeout=10)

    def test_entrega_o_arquivo_no_caminho_exato_com_o_tipo_certo(self):
        self.assertEqual(self.caminho, '/TOKENSECRETO/video.mp4')              # nome publico simples, sem acento
        r = self._get(self.caminho)
        self.assertEqual((r.status, r.headers['Content-Type'], int(r.headers['Content-Length'])), (200, 'video/mp4', 10000))
        self.assertEqual(r.read(), b'0123456789' * 1000)
        self.assertEqual(self._get(self.caminho, 'HEAD').status, 200)

    def test_qualquer_outro_caminho_e_404(self):
        for ruim in ('/', '/TOKENERRADO/video.mp4', '/TOKENSECRETO/', '/TOKENSECRETO/outro.mp4', '/TOKENSECRETO/../x', '/video.mp4'):
            with self.assertRaises(urllib.error.HTTPError) as e:
                self._get(ruim)
            self.assertEqual(e.exception.code, 404, ruim)

    def test_so_escuta_no_proprio_computador(self):
        self.assertEqual(self.servidor.server_address[0], '127.0.0.1')


class TunelComCloudflaredDeMentira(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.arq = self.tmp / 'v.mp4'
        self.arq.write_bytes(b'x' * 50)
        self.falso = self.tmp / 'falso.py'
        self.falso.write_text("import sys,time\nprint('2026 INF Your quick Tunnel: https://abc-def-123.trycloudflare.com', flush=True)\ntime.sleep(60)\n")
        self.cmd = [sys.executable, str(self.falso)]

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_devolve_a_url_publica_com_caminho_secreto_e_fecha_tudo_ao_sair(self):
        t = tt.TunelTemporario(self.arq, cloudflared=self.cmd, tempo_limite=20, verificar_publico=False)
        with t as url:
            self.assertRegex(url, r'^https://abc-def-123\.trycloudflare\.com/[A-Za-z0-9_-]{20,}/video\.mp4$')
            porta, processo = t._servidor.server_address[1], t._proc
            caminho = urllib.parse.urlparse(url).path
            # enquanto aberto, o arquivo esta acessivel (localmente) no caminho secreto
            self.assertEqual(urllib.request.urlopen('http://127.0.0.1:%d%s' % (porta, caminho), timeout=10).read(), b'x' * 50)
            self.assertIsNone(processo.poll())                    # tunel rodando
        # ao sair: tunel encerrado e servidor local fora do ar (o arquivo deixa de estar acessivel)
        self.assertIsNotNone(processo.poll())
        with self.assertRaises(urllib.error.URLError):
            urllib.request.urlopen('http://127.0.0.1:%d%s' % (porta, caminho), timeout=3)

    def test_se_o_endereco_nunca_responde_pela_internet_falha_e_fecha_tudo(self):
        t = tt.TunelTemporario(self.arq, cloudflared=self.cmd, tempo_limite=20, verificar_publico=True, espera_publica=3)
        with self.assertRaises(tt.ErroTunel) as e:
            t.__enter__()                                # abc-def-123.trycloudflare.com nao existe de verdade
        self.assertIn('nao ficou acessivel', str(e.exception))
        self.assertIsNone(t._proc)
        self.assertIsNone(t._servidor)

    def test_arquivo_ausente_da_erro_claro(self):
        with self.assertRaises(tt.ErroTunel):
            tt.TunelTemporario(self.tmp / 'nao-existe.mp4', cloudflared=self.cmd)

    def test_se_o_cloudflared_nao_der_endereco_falha_e_nao_deixa_processo_para_tras(self):
        mudo = self.tmp / 'mudo.py'
        mudo.write_text("import time\ntime.sleep(60)\n")
        t = tt.TunelTemporario(self.arq, cloudflared=[sys.executable, str(mudo)], tempo_limite=2, verificar_publico=False)
        with self.assertRaises(tt.ErroTunel):
            t.__enter__()
        self.assertIsNone(t._proc)
        self.assertIsNone(t._servidor)


if __name__ == '__main__':
    unittest.main()
