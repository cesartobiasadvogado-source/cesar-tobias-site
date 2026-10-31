"""Roda com (dentro da pasta): python -m unittest test_edicao_agora -v   (sem Whisper, sem ffmpeg, sem internet)"""
import json
import os
import shutil
import tempfile
import unittest
from datetime import date
from pathlib import Path

import edicao_agora as ea
import rotina_marketing as rm

FALA = 'Este video explica o prazo para contestar uma acao trabalhista na citacao.'


class PainelFalso:
    def __init__(self, conteudos=()):
        self.conteudos = {c['id']: c for c in conteudos}
        self.escritas = []
        self.falhar_andamento = False

    def listar(self, status):
        return [c for c in self.conteudos.values() if c['status'] == status]

    def atualizar(self, i, campos):
        if self.falhar_andamento and set(campos) == {'edicao'}:
            raise RuntimeError('painel fora do ar')
        self.escritas.append((i, campos))
        self.conteudos[i].update(campos)

    def andamentos(self, i=None):
        return [c['edicao']['andamento'] for ident, c in self.escritas if 'edicao' in c and 'andamento' in c['edicao']
                and (i is None or ident == i)]


class EstadoFalso:
    def __init__(self):
        self.dados = {}

    def get(self, chave):
        return self.dados.get(chave)

    def marcar(self, chave, **campos):
        self.dados.setdefault(chave, {}).update(campos)


def conteudo(**kw):
    base = {'id': 7, 'titulo': 'Prazo para contestar', 'roteiro': FALA, 'status': 'gravado', 'redes': ['instagram', 'tiktok'],
            'arquivos': {}, 'data_postagem': None, 'sugestao_data': None, 'publicacao': {},
            'edicao': {'confirmado': True, 'cortar_pausas': True, 'legenda': 'simples',
                       'andamento': {'estado': 'fila', 'etapa': 'Na fila', 'pct': 0, 'em': '2026-10-30T20:00:00-03:00'}}}
    base.update(kw)
    return base


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        for p in ('1-Brutos', '2-Editados', '_rotina'):
            (self.tmp / p).mkdir()
        self.video = self.tmp / '1-Brutos' / 'video teste.MOV'
        self.video.write_bytes(b'x' * 100)
        self.config = {'pasta_base': str(self.tmp), 'horarios': ['18:30']}
        self.estado = EstadoFalso()
        self.transcricoes, self.edicoes = [], []
        self.relogio = iter(range(1793400000, 1793400000 + 10 ** 6, 10))          # cada chamada avanca 10 s: nada e "muito rapido"

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def tempo(self):
        return next(self.relogio)

    def transcrever(self, video, pasta):
        self.transcricoes.append(video.name)
        pasta = Path(pasta)
        pasta.mkdir(parents=True, exist_ok=True)
        srt = pasta / (video.stem + '.srt')
        srt.write_text('1\n00:00:00,000 --> 00:00:02,000\nola\n', encoding='utf-8')
        srt.with_suffix('.json').write_text(json.dumps({'segments': [{'words': [{'word': ' Este', 'start': 0.1, 'end': 0.4}]}]}), encoding='utf-8')
        return FALA, srt

    def editar(self, video, pasta, opcoes=None, palavras=None, nome_base=None, progresso=None):
        self.edicoes.append({'video': video.name, 'nome_base': nome_base, 'opcoes': opcoes, 'palavras': palavras})
        for etapa, pct in (('Analisando o vídeo', 3), ('Cortando', 40), ('Cortando', 85), ('Criando as capas', 90), ('Salvando', 96)):
            progresso(etapa, pct)
        saida = Path(pasta)
        (saida / (nome_base + '_editado.mp4')).write_bytes(b'v')
        dados = {r: {'video': nome_base + '_editado.mp4', 'capa': '%s_capa_%s.jpg' % (nome_base, r), 'miniatura': 'data:image/jpeg;base64,AA'}
                 for r in ('instagram', 'tiktok')}
        arq = saida / (nome_base + '_arquivos.json')
        arq.write_text(json.dumps(dados), encoding='utf-8')
        return {'arquivos_json': str(arq)}

    def rodar(self, painel, c=None, **kw):
        return ea.editar_agora(c or painel.conteudos[7], self.config, painel, self.estado, transcrever=self.transcrever,
                               editar=self.editar, relogio=self.tempo, hoje=lambda: date(2026, 10, 30), log=lambda *_: None, **kw)


class EditarAgora(Base):
    def test_caminho_feliz_transcreve_edita_grava_arquivos_e_fecha_a_barra_em_100(self):
        painel = PainelFalso([conteudo()])
        r = self.rodar(painel)
        self.assertEqual(r, ('pronto', None))
        c = painel.conteudos[7]
        self.assertEqual(c['arquivos']['instagram']['video'], 'video teste_editado.mp4')
        self.assertEqual((c['sugestao_data'], c['sugestao_hora']), ('2026-10-31', '18:30'))
        self.assertEqual(c['edicao']['andamento']['estado'], 'pronto')
        self.assertEqual(c['edicao']['andamento']['pct'], 100)
        self.assertEqual(self.transcricoes, ['video teste.MOV'])
        self.assertEqual(self.estado.dados[rm.chave_arquivo(self.video)]['status'], 'concluido')
        self.assertEqual(self.edicoes[0]['opcoes'], {'cortar_pausas': True, 'legenda': 'simples'})

    def test_a_barra_so_sobe_e_nunca_passa_de_100(self):
        painel = PainelFalso([conteudo()])
        self.rodar(painel)
        pcts = [a['pct'] for a in painel.andamentos() if a['pct'] is not None]
        self.assertEqual(pcts, sorted(pcts))
        self.assertTrue(all(0 <= p <= 100 for p in pcts))
        self.assertEqual(painel.andamentos()[0]['estado'], 'rodando')
        self.assertIn(None, [a['pct'] for a in painel.andamentos()])                  # transcrevendo: sem % inventada

    def test_o_andamento_nao_apaga_as_escolhas_de_edicao(self):
        painel = PainelFalso([conteudo()])
        self.rodar(painel)
        for _, campos in painel.escritas:
            if 'edicao' in campos:
                self.assertEqual((campos['edicao']['confirmado'], campos['edicao']['legenda']), (True, 'simples'))

    def test_transcricao_ja_feita_nao_e_refeita(self):
        painel = PainelFalso([conteudo()])
        fala, srt = self.transcrever(self.video, self.tmp / '_rotina' / 'transcricoes')
        self.estado.marcar(rm.chave_arquivo(self.video), fala=fala, srt=str(srt))
        self.transcricoes.clear()
        self.rodar(painel)
        self.assertEqual(self.transcricoes, [])

    def test_nunca_sobrescreve_um_editado_que_ja_existe(self):
        (self.tmp / '2-Editados' / 'video teste_editado.mp4').write_bytes(b'antigo')
        painel = PainelFalso([conteudo()])
        self.rodar(painel)
        self.assertEqual(self.edicoes[0]['nome_base'], 'video teste_2')
        self.assertEqual((self.tmp / '2-Editados' / 'video teste_editado.mp4').read_bytes(), b'antigo')
        self.assertEqual(painel.conteudos[7]['arquivos']['instagram']['video'], 'video teste_2_editado.mp4')

    def test_nao_toca_no_video_original(self):
        self.rodar(PainelFalso([conteudo()]))
        self.assertEqual(self.video.read_bytes(), b'x' * 100)

    def test_erro_vira_mensagem_no_cartao_e_nao_levanta(self):
        def quebra(*a, **k):
            raise RuntimeError('ffmpeg (edicao) falhou: disco cheio')
        painel = PainelFalso([conteudo()])
        r = ea.editar_agora(painel.conteudos[7], self.config, painel, self.estado, transcrever=self.transcrever, editar=quebra,
                            relogio=self.tempo, log=lambda *_: None)
        self.assertEqual(r[0], 'erro')
        ultimo = painel.andamentos()[-1]
        self.assertEqual(ultimo['estado'], 'erro')
        self.assertIn('disco cheio', ultimo['erro'])
        self.assertEqual(painel.conteudos[7]['arquivos'], {})
        self.assertNotIn(rm.chave_arquivo(self.video), [k for k, v in self.estado.dados.items() if v.get('status') == 'concluido'])

    def test_falha_ao_gravar_o_andamento_nao_derruba_a_edicao(self):
        painel = PainelFalso([conteudo()])
        painel.falhar_andamento = True
        r = self.rodar(painel)
        self.assertEqual(r[0], 'pronto')
        self.assertEqual(painel.conteudos[7]['arquivos']['instagram']['video'], 'video teste_editado.mp4')

    def test_nao_inventa_data_se_o_conteudo_ja_tem_dia_marcado(self):
        painel = PainelFalso([conteudo(data_postagem='2026-11-05')])
        self.rodar(painel)
        self.assertNotIn('sugestao_data', [k for _, campos in painel.escritas for k in campos])


class AcharVideo(Base):
    def test_usa_o_que_a_rotina_ja_achou_depois_o_unico_da_pasta(self):
        outro = self.tmp / '1-Brutos' / 'outro.mp4'
        outro.write_bytes(b'y')
        c = conteudo(edicao={'video_encontrado': 'outro.mp4'})
        self.assertEqual(ea.achar_video(c, self.tmp / '1-Brutos', self.estado).name, 'outro.mp4')
        outro.unlink()
        self.assertEqual(ea.achar_video(conteudo(), self.tmp / '1-Brutos', self.estado).name, 'video teste.MOV')

    def test_varios_videos_decide_pela_fala_ou_recusa_com_mensagem_clara(self):
        outro = self.tmp / '1-Brutos' / 'IMG_9.mp4'
        outro.write_bytes(b'yy')
        with self.assertRaises(RuntimeError) as e:
            ea.achar_video(conteudo(), self.tmp / '1-Brutos', self.estado)
        self.assertIn('não sei qual vídeo', str(e.exception))
        self.estado.marcar(rm.chave_arquivo(self.video), fala=FALA)
        self.assertEqual(ea.achar_video(conteudo(), self.tmp / '1-Brutos', self.estado).name, 'video teste.MOV')

    def test_pasta_vazia(self):
        self.video.unlink()
        with self.assertRaises(RuntimeError) as e:
            ea.achar_video(conteudo(), self.tmp / '1-Brutos', self.estado)
        self.assertIn('1-Brutos', str(e.exception))


class Ciclo(Base):
    def ciclo(self, painel, **kw):
        return ea.ciclo_edicao(painel, self.config, self.estado, relogio=self.tempo, log=lambda *_: None,
                               transcrever=self.transcrever, editar=self.editar, hoje=lambda: date(2026, 10, 30), **kw)

    def test_pedido_na_fila_e_editado(self):
        painel = PainelFalso([conteudo()])
        feitos = self.ciclo(painel)
        self.assertEqual([f['resultado'] for f in feitos], ['pronto'])
        self.assertFalse((self.tmp / '_rotina' / 'rodando.lock').exists())                 # solta a trava

    def test_sem_pedido_nao_pega_a_trava_nem_edita(self):
        painel = PainelFalso([conteudo(edicao={'confirmado': True}), conteudo(id=8, edicao={'confirmado': True, 'andamento': {'estado': 'pronto'}})])
        self.assertEqual(self.ciclo(painel), [])
        self.assertEqual((self.edicoes, painel.escritas), ([], []))

    def test_conteudo_que_ja_tem_video_nao_e_editado_de_novo(self):
        painel = PainelFalso([conteudo(arquivos={'instagram': {'video': 'v_editado.mp4'}})])
        self.assertEqual(self.ciclo(painel), [])
        self.assertEqual(self.edicoes, [])

    def test_rodando_de_uma_execucao_que_morreu_vira_erro_e_nao_roda_sozinho(self):
        c = conteudo()
        c['edicao']['andamento'] = {'estado': 'rodando', 'etapa': 'Cortando', 'pct': 50}
        painel = PainelFalso([c])
        feitos = self.ciclo(painel)
        self.assertEqual([f['resultado'] for f in feitos], ['interrompida'])
        self.assertEqual(painel.conteudos[7]['edicao']['andamento']['estado'], 'erro')
        self.assertIn('interrompida', painel.conteudos[7]['edicao']['andamento']['erro'])
        self.assertEqual(self.edicoes, [])

    def test_erro_nao_e_repetido_sozinho(self):
        c = conteudo()
        c['edicao']['andamento'] = {'estado': 'erro', 'erro': 'x'}
        self.assertEqual(self.ciclo(PainelFalso([c])), [])
        self.assertEqual(self.edicoes, [])

    def test_se_a_rotina_esta_editando_o_pedido_espera_na_fila(self):
        arq = self.tmp / '_rotina' / 'rodando.lock'
        arq.write_bytes(b'')                                  # trava da rotina: sem numero de processo
        os.utime(str(arq), None)
        painel = PainelFalso([conteudo()])
        ea_relogio = lambda: arq.stat().st_mtime + 60
        feitos = ea.ciclo_edicao(painel, self.config, self.estado, relogio=ea_relogio, log=lambda *_: None,
                                 transcrever=self.transcrever, editar=self.editar)
        self.assertEqual((feitos, self.edicoes), ([], []))
        self.assertEqual(painel.conteudos[7]['edicao']['andamento']['estado'], 'fila')
        self.assertTrue(arq.exists())                         # nao roubou nem apagou a trava da rotina


class Trava(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_trava_de_processo_morto_e_tomada_na_hora(self):
        (self.tmp / 'rodando.lock').write_text('424242')
        with ea.trava_edicao(self.tmp, processo_vivo=lambda pid: False) as pegou:
            self.assertTrue(pegou)

    def test_trava_de_processo_vivo_nao_e_roubada(self):
        (self.tmp / 'rodando.lock').write_text('424242')
        with ea.trava_edicao(self.tmp, processo_vivo=lambda pid: True) as pegou:
            self.assertFalse(pegou)
        self.assertTrue((self.tmp / 'rodando.lock').exists())

    def test_so_um_por_vez_e_solta_no_fim(self):
        with ea.trava_edicao(self.tmp, processo_vivo=lambda pid: True) as a:
            with ea.trava_edicao(self.tmp, processo_vivo=lambda pid: True) as b:
                self.assertEqual((a, b), (True, False))
        self.assertFalse((self.tmp / 'rodando.lock').exists())


class Barra(Base):
    def test_nao_martela_o_painel_com_atualizacoes_muito_seguidas(self):
        painel = PainelFalso([conteudo()])
        t = [1793400000.0]
        barra = ea.Andamento(painel, painel.conteudos[7], relogio=lambda: t[0], log=lambda *_: None)
        for pct in range(10, 20):
            t[0] += 0.1
            barra.mudar('rodando', 'Cortando', pct)
        self.assertEqual(len(painel.escritas), 1)
        t[0] += 5
        barra.mudar('rodando', 'Cortando', 40)
        self.assertEqual(len(painel.escritas), 2)
        barra.mudar('rodando', 'Criando as capas', 90)                                    # etapa nova: sempre grava
        self.assertEqual(len(painel.escritas), 3)


if __name__ == '__main__':
    unittest.main()
