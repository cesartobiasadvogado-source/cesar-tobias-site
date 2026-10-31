"""Roda com (dentro da pasta): python -m unittest test_vigia_metricool -v   (sem internet, sem Metricool de verdade)"""
import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

import publicar_metricool as pm
import vigia_metricool as vg
from test_publicar_metricool import AGORA, ClienteFalso, TunelFalso, conteudo


class PainelListando:
    def __init__(self, conteudos):
        self.conteudos, self.atualizacoes, self.listagens = conteudos, [], []

    def listar(self, status):
        self.listagens.append(status)
        return [c for c in self.conteudos if c['status'] == status]

    def atualizar(self, i, campos):
        self.atualizacoes.append((i, campos))


class Ciclo(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        (self.tmp / '2-Editados').mkdir()
        (self.tmp / '2-Editados' / 'v.mp4').write_bytes(b'video')
        self.config = {'pasta_base': str(self.tmp), 'metricool': {'ativo': True, 'marca_id': '1', 'modo': 'rascunho'}}
        self.cliente = ClienteFalso()
        self.aberturas = 0
        TunelFalso.historico, TunelFalso.falha = [], None

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def fabrica(self):
        self.aberturas += 1
        return self.cliente

    def ciclo(self, painel, config=None):
        return vg.um_ciclo(painel, config or self.config, self.fabrica, TunelFalso, lambda: AGORA, log=lambda *_: None)

    def test_clique_no_botao_vira_rascunho_no_metricool(self):
        painel = PainelListando([conteudo()])
        feitos = self.ciclo(painel)
        self.assertEqual([f['resultado'] for f in feitos], ['rascunho'])
        self.assertEqual(len(self.cliente.chamadas), 1)

    def test_sem_pedido_nao_abre_metricool_nem_mexe_no_painel(self):
        painel = PainelListando([conteudo(publicacao={'legenda': 'x', 'revisada': True, 'programar': False})])
        self.assertEqual(self.ciclo(painel), [])
        self.assertEqual((self.aberturas, painel.atualizacoes, self.cliente.chamadas), (0, [], []))

    def test_ja_programado_ou_com_erro_nao_e_enviado_de_novo(self):
        for met in ({'status': 'rascunho', 'uuid': 'U'}, {'status': 'erro', 'erro': 'x'}, {'status': 'programado', 'uuid': 'U'}):
            painel = PainelListando([conteudo(publicacao={'legenda': 'x', 'revisada': True, 'programar': True, 'metricool': met})])
            self.assertEqual(self.ciclo(painel), [])
        self.assertEqual(self.cliente.chamadas, [])

    def test_metricool_desligado_na_config_nao_faz_nada(self):
        cfg = dict(self.config, metricool={'ativo': False})
        painel = PainelListando([conteudo()])
        self.assertEqual(self.ciclo(painel, cfg), [])
        self.assertEqual(painel.listagens, [])

    def test_dois_ciclos_seguidos_nao_duplicam(self):
        c = conteudo()
        painel = PainelListando([c])
        self.ciclo(painel)
        # o painel de verdade devolve o estado gravado; aqui simulamos
        c['publicacao']['metricool'] = {'status': 'rascunho', 'uuid': 'U-55'}
        self.ciclo(painel)
        self.assertEqual(len(self.cliente.chamadas), 1)

    def test_enquanto_outro_programa_o_vigia_espera_o_proximo_ciclo(self):
        (self.tmp / '_rotina').mkdir()
        os.close(os.open(str(self.tmp / '_rotina' / 'programando.lock'), os.O_CREAT | os.O_WRONLY))
        os.utime(str(self.tmp / '_rotina' / 'programando.lock'), (AGORA, AGORA))
        self.assertEqual(self.ciclo(PainelListando([conteudo()])), [])
        self.assertEqual(self.cliente.chamadas, [])


class Trava(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_so_um_pega_e_solta_no_fim(self):
        with pm.trava_programacao(self.tmp) as a:
            with pm.trava_programacao(self.tmp) as b:
                self.assertEqual((a, b), (True, False))
        with pm.trava_programacao(self.tmp) as c:
            self.assertTrue(c)

    def test_trava_esquecida_por_queda_de_energia_vence_em_20_minutos(self):
        arq = self.tmp / 'programando.lock'
        arq.write_bytes(b'')
        os.utime(str(arq), (AGORA - 21 * 60, AGORA - 21 * 60))
        with pm.trava_programacao(self.tmp, agora=lambda: AGORA) as pegou:
            self.assertTrue(pegou)

    def test_trava_recente_nao_e_roubada(self):
        arq = self.tmp / 'programando.lock'
        arq.write_bytes(b'')
        os.utime(str(arq), (AGORA - 60, AGORA - 60))
        with pm.trava_programacao(self.tmp, agora=lambda: AGORA) as pegou:
            self.assertFalse(pegou)


if __name__ == '__main__':
    unittest.main()
