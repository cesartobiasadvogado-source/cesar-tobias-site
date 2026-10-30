"""Roda com (dentro da pasta): python -m unittest test_rotina_marketing -v
Nada aqui chama a internet, o Whisper nem o ffmpeg: tudo que fica fora e trocado por falso."""
import json
import os
import shutil
import tempfile
import unittest
from datetime import date
from pathlib import Path

import rotina_marketing as rm

FALA_EP6 = ('Hoje eu vou mostrar como a tramitação inteligente funciona junto com o Claude e o ADVBOX, '
            'os três conversam entre si e acompanham cada processo sem você precisar abrir o tribunal.')
EP6 = {'id': 6, 'titulo': 'Ep. 6 - Tramitação inteligente + Claude + ADVBOX', 'redes': ['instagram', 'tiktok'],
       'roteiro': 'Mostrar como a tramitação inteligente conversa com o Claude e o ADVBOX e acompanha cada processo.',
       'arquivos': {}}
FIM6X1 = {'id': 18, 'titulo': 'Fim da 6x1 - Parte 2: minha empresa abre domingo', 'redes': ['instagram'],
          'roteiro': 'Se a empresa abre domingo, como fica a escala do funcionário na nova jornada?', 'arquivos': {}}


class Correspondencia(unittest.TestCase):
    def test_normalizar_tira_acento_e_pontuacao(self):
        self.assertEqual(rm.normalizar('Tramitação, Inteligente!').split(), ['tramitacao', 'inteligente'])

    def test_escolhe_o_roteiro_certo(self):
        achado, ranking = rm.escolher_correspondencia(FALA_EP6, [FIM6X1, EP6])
        self.assertEqual(achado['id'], 6)
        self.assertGreater(ranking[0][0], rm.MIN_PONTUACAO)

    def test_fala_de_outro_assunto_nao_casa(self):
        achado, _ = rm.escolher_correspondencia('Bom dia pessoal, hoje o tempo está ótimo para passear no parque.', [EP6, FIM6X1])
        self.assertIsNone(achado)

    def test_roteiros_identicos_ficam_para_a_pessoa_decidir(self):
        a = dict(EP6, id=1, titulo='Prazo trabalhista', roteiro='Prazo da reclamação trabalhista e da contestação')
        b = dict(a, id=2)
        achado, _ = rm.escolher_correspondencia('o prazo da reclamação trabalhista e da contestação', [a, b])
        self.assertIsNone(achado)

    def test_serie_com_roteiros_parecidos_decide_pela_palavra_que_diferencia(self):
        # "Fim da 6x1": os episodios dividem o tema e diferem em poucas palavras
        ep2 = {'id': 2, 'titulo': 'Fim da 6x1 - Parte 2: minha empresa abre domingo', 'redes': [],
               'roteiro': 'Minha empresa abre domingo, como fica a escala do funcionário na nova jornada?'}
        ep3 = {'id': 3, 'titulo': 'Fim da 6x1 - Parte 3: o funcionário pode recusar a nova escala?', 'redes': [],
               'roteiro': 'O funcionário pode recusar a nova escala na nova jornada da empresa?'}
        fala = 'Minha empresa abre domingo, então como fica a escala do funcionário na nova jornada de trabalho?'
        achado, ranking = rm.escolher_correspondencia(fala, [ep3, ep2])
        self.assertEqual(achado['id'], 2, ranking)

    def test_sem_candidatos_nao_quebra(self):
        achado, ranking = rm.escolher_correspondencia('qualquer fala', [])
        self.assertIsNone(achado)
        self.assertEqual(ranking, [])

    def test_roteiro_so_com_uma_palavra_nao_decide(self):
        self.assertEqual(rm.pontuar('video sobre prazo', 'Prazo', None), 0.0)

    def test_texto_do_srt_ignora_numero_e_tempo(self):
        srt = '1\n00:00:00,000 --> 00:00:02,000\nOlá, tudo bem?\n\n2\n00:00:02,000 --> 00:00:04,000\nVamos começar.\n'
        self.assertEqual(rm.texto_do_srt(srt), 'Olá, tudo bem? Vamos começar.')


class Sugestao(unittest.TestCase):
    HOJE = date(2026, 11, 2)  # segunda-feira

    def test_comeca_amanha(self):
        self.assertEqual(rm.proxima_sugestao(set(), self.HOJE), ('2026-11-03', '18:30'))

    def test_pula_horario_ocupado(self):
        ocupados = {('2026-11-03', '18:30')}
        self.assertEqual(rm.proxima_sugestao(ocupados, self.HOJE), ('2026-11-04', '18:30'))

    def test_usa_segundo_horario_do_mesmo_dia(self):
        ocupados = {('2026-11-03', '12:00')}
        self.assertEqual(rm.proxima_sugestao(ocupados, self.HOJE, horarios=('12:00', '18:30')), ('2026-11-03', '18:30'))

    def test_respeita_dias_da_semana(self):
        # so segunda a sexta: de sexta (06/11) o proximo e segunda (09/11)
        self.assertEqual(rm.proxima_sugestao(set(), date(2026, 11, 6), dias_semana=(0, 1, 2, 3, 4)), ('2026-11-09', '18:30'))

    def test_ocupados_vem_dos_agendados_e_das_sugestoes(self):
        conteudos = [
            {'status': 'agendado', 'data_postagem': '2026-11-03', 'hora_postagem': '18:30:00'},
            {'status': 'gravado', 'sugestao_data': '2026-11-04', 'sugestao_hora': '18:30:00'},
            {'status': 'postado', 'data_postagem': '2026-11-05', 'hora_postagem': '18:30:00'},  # passado: nao conta
        ]
        self.assertEqual(rm.horarios_ocupados(conteudos), {('2026-11-03', '18:30'), ('2026-11-04', '18:30')})


class Arquivos(unittest.TestCase):
    def test_juntar_preserva_link_que_a_pessoa_colou(self):
        existentes = {'instagram': {'link_video': 'https://drive.google.com/file/d/ABCDEFGHIJ/view', 'video': 'velho.mp4'}}
        novos = {'instagram': {'video': 'novo.mp4', 'capa': 'c.jpg', 'miniatura': 'data:image/jpeg;base64,AA'},
                 'tiktok': {'video': 'novo.mp4', 'capa': 'c2.jpg'}}
        r = rm.juntar_arquivos(existentes, novos, ['instagram'])
        self.assertEqual(r['instagram']['video'], 'novo.mp4')
        self.assertIn('link_video', r['instagram'])
        self.assertNotIn('tiktok', r)  # o conteudo so e para Instagram

    def test_sem_redes_no_conteudo_vale_para_as_duas(self):
        novos = {'instagram': {'video': 'a.mp4'}, 'tiktok': {'video': 'a.mp4'}}
        self.assertEqual(sorted(rm.juntar_arquivos({}, novos, [])), ['instagram', 'tiktok'])


class ListarNovos(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.agora = 1_800_000_000

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _criar(self, nome, idade_s=3600, tamanho=10):
        p = self.tmp / nome
        p.write_bytes(b'x' * tamanho)
        os.utime(p, (self.agora - idade_s, self.agora - idade_s))
        return p

    def test_filtra_extensao_oculto_vazio_e_arquivo_ainda_sendo_gravado(self):
        self._criar('ok.mp4')
        self._criar('desktop.ini')
        self._criar('.oculto.mp4')
        self._criar('~lock.mp4')
        self._criar('vazio.mp4', tamanho=0)
        self._criar('gravando.mp4', idade_s=30)
        achados = rm.listar_novos(self.tmp, {}, agora=self.agora)
        self.assertEqual([a.name for a, _ in achados], ['ok.mp4'])

    def test_ignora_concluidos_e_os_que_estouraram_tentativas(self):
        feito = self._criar('feito.mp4')
        ruim = self._criar('ruim.mp4')
        novo = self._criar('novo.mp4')
        estado = {rm.chave_arquivo(feito): {'status': 'concluido'},
                  rm.chave_arquivo(ruim): {'tentativas': rm.TENTATIVAS_MAX}}
        achados = rm.listar_novos(self.tmp, estado, agora=self.agora)
        self.assertEqual([a.name for a, _ in achados], ['novo.mp4'])
        self.assertEqual(achados[0][1], rm.chave_arquivo(novo))


class PainelFalso:
    def __init__(self, gravados, agendados=()):
        self.gravados, self.agendados = list(gravados), list(agendados)
        self.atualizacoes, self.entrou = [], 0

    def entrar(self):
        self.entrou += 1

    def listar(self, status):
        return list(self.gravados if status == 'gravado' else self.agendados)

    def atualizar(self, conteudo_id, campos):
        self.atualizacoes.append((conteudo_id, campos))


class Orquestracao(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.base = self.tmp / 'MKT'
        (self.base / '1-Brutos').mkdir(parents=True)
        (self.base / '2-Editados').mkdir()
        self.video = self.base / '1-Brutos' / 'ep6.mp4'
        self.video.write_bytes(b'bruto-original')
        antigo = 1_700_000_000
        os.utime(self.video, (antigo, antigo))
        self.config = {'pasta_base': str(self.base), 'horarios': ['18:30']}
        self.editou, self.transcreveu = [], []

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def deps(self, painel, fala=FALA_EP6, editar_falha=None):
        def transcrever(video, pasta):
            self.transcreveu.append(video.name)
            Path(pasta).mkdir(parents=True, exist_ok=True)
            srt = Path(pasta) / (video.stem + '.srt')
            srt.write_text('1\n00:00:00,000 --> 00:00:01,000\n' + fala + '\n', encoding='utf-8')
            return fala, srt

        def editar(video, pasta, legenda=None):
            if editar_falha:
                raise RuntimeError(editar_falha)
            self.editou.append((video.name, legenda))
            arq = Path(pasta) / (video.stem + '_arquivos.json')
            arq.write_text(json.dumps({
                'instagram': {'video': video.stem + '_editado.mp4', 'capa': video.stem + '_capa_instagram.jpg', 'miniatura': 'data:image/jpeg;base64,AAAA'},
                'tiktok': {'video': video.stem + '_editado.mp4', 'capa': video.stem + '_capa_tiktok.jpg', 'miniatura': 'data:image/jpeg;base64,AAAA'},
            }), encoding='utf-8')
            return {'arquivos_json': str(arq)}

        return rm.Dependencias(painel, transcrever=transcrever, editar=editar, agora=lambda: 1_800_000_000,
                               hoje=lambda: date(2026, 11, 2))

    def test_processa_prepara_e_so_sugere(self):
        painel = PainelFalso([EP6, FIM6X1])
        rel = rm.executar(self.config, self.deps(painel), log=lambda *_: None)
        self.assertEqual(len(rel['processados']), 1)
        self.assertEqual(self.editou[0][0], 'ep6.mp4')
        self.assertTrue(str(self.editou[0][1]).endswith('ep6.srt'))  # legenda do Whisper vai para a edicao
        (conteudo_id, campos), = painel.atualizacoes
        self.assertEqual(conteudo_id, 6)
        self.assertEqual(sorted(campos['arquivos']), ['instagram', 'tiktok'])
        self.assertEqual((campos['sugestao_data'], campos['sugestao_hora']), ('2026-11-03', '18:30'))
        # a rotina NUNCA agenda nem muda status/data de postagem: quem aprova e a pessoa
        for proibido in ('status', 'data_postagem', 'hora_postagem'):
            self.assertNotIn(proibido, campos)
        self.assertEqual(self.video.read_bytes(), b'bruto-original')  # original intacto

    def test_segunda_rodada_nao_repete_o_trabalho(self):
        painel = PainelFalso([EP6])
        rm.executar(self.config, self.deps(painel), log=lambda *_: None)
        rel = rm.executar(self.config, self.deps(painel), log=lambda *_: None)
        self.assertEqual(rel['processados'], [])
        self.assertEqual(len(painel.atualizacoes), 1)
        self.assertEqual(len(self.editou), 1)

    def test_sem_correspondencia_nao_edita_nem_mexe_no_painel_e_nao_retranscreve(self):
        painel = PainelFalso([FIM6X1])
        rel = rm.executar(self.config, self.deps(painel, fala='Assunto totalmente diferente sobre outra coisa qualquer.'), log=lambda *_: None)
        self.assertEqual(rel['sem_correspondencia'], ['ep6.mp4'])
        self.assertEqual((self.editou, painel.atualizacoes), ([], []))
        rm.executar(self.config, self.deps(painel, fala='x'), log=lambda *_: None)
        self.assertEqual(len(self.transcreveu), 1)  # a fala fica guardada: nao gasta Whisper de novo

    def test_depois_do_gravei_o_mesmo_video_casa_na_proxima_rodada(self):
        painel = PainelFalso([])
        rm.executar(self.config, self.deps(painel), log=lambda *_: None)
        self.assertEqual(painel.atualizacoes, [])
        painel.gravados = [EP6]  # a pessoa apertou "Gravei"
        rel = rm.executar(self.config, self.deps(painel), log=lambda *_: None)
        self.assertEqual(len(rel['processados']), 1)
        self.assertEqual(len(self.transcreveu), 1)

    def test_erro_em_um_video_conta_tentativa_e_nao_derruba(self):
        painel = PainelFalso([EP6])
        rel = rm.executar(self.config, self.deps(painel, editar_falha='ffmpeg quebrou'), log=lambda *_: None)
        self.assertEqual(rel['erros'][0]['tentativa'], 1)
        self.assertEqual(painel.atualizacoes, [])
        for _ in range(rm.TENTATIVAS_MAX):
            rm.executar(self.config, self.deps(painel, editar_falha='ffmpeg quebrou'), log=lambda *_: None)
        rel = rm.executar(self.config, self.deps(painel), log=lambda *_: None)
        self.assertEqual(rel['processados'], [])  # estourou as tentativas: para de insistir

    def test_so_listar_nao_entra_no_painel(self):
        painel = PainelFalso([EP6])
        rel = rm.executar(self.config, self.deps(painel), so_listar=True, log=lambda *_: None)
        self.assertEqual(rel['aguardando'], ['ep6.mp4'])
        self.assertEqual((painel.entrou, self.transcreveu, self.editou), (0, [], []))

    def test_sugestao_nao_repete_horario_entre_videos_da_mesma_rodada(self):
        outro = self.base / '1-Brutos' / 'ep7.mp4'
        outro.write_bytes(b'outro')
        os.utime(outro, (1_700_000_001, 1_700_000_001))
        ep7 = dict(FIM6X1, id=7)
        painel = PainelFalso([EP6, ep7])
        deps = self.deps(painel)
        deps.transcrever = lambda v, p: (FALA_EP6 if v.name == 'ep6.mp4' else FIM6X1['roteiro'] + ' ' + FIM6X1['titulo'],
                                         self._srt(p, v))
        rm.executar(self.config, deps, log=lambda *_: None)
        datas = sorted(c['sugestao_data'] for _, c in painel.atualizacoes)
        self.assertEqual(datas, ['2026-11-03', '2026-11-04'])

    def _srt(self, pasta, video):
        Path(pasta).mkdir(parents=True, exist_ok=True)
        srt = Path(pasta) / (video.stem + '.srt')
        srt.write_text('1\n00:00:00,000 --> 00:00:01,000\nx\n', encoding='utf-8')
        return srt


class RespostaFalsa:
    def __init__(self, status, corpo):
        self.status_code, self._corpo = status, corpo

    def json(self):
        return self._corpo


class HttpFalso:
    def __init__(self, respostas):
        self.respostas, self.chamadas = list(respostas), []

    def _proxima(self, metodo, url, kw):
        self.chamadas.append((metodo, url, kw))
        return self.respostas.pop(0)

    def post(self, url, **kw):
        return self._proxima('POST', url, kw)

    def get(self, url, **kw):
        return self._proxima('GET', url, kw)


class ClientePainel(unittest.TestCase):
    def test_login_guarda_token_e_esquece_a_senha(self):
        http = HttpFalso([RespostaFalsa(200, {'token': 'abc'})])
        p = rm.Painel('https://exemplo.com/', 'rotina', 'segredo', http)
        p.entrar()
        self.assertEqual(p.token, 'abc')
        self.assertIsNone(p._senha)
        self.assertEqual(http.chamadas[0][1], 'https://exemplo.com/api/painel?acao=login')
        self.assertEqual(http.chamadas[0][2]['json'], {'usuario': 'rotina', 'senha': 'segredo'})

    def test_login_recusado_levanta_erro_sem_vazar_a_senha(self):
        p = rm.Painel('https://exemplo.com', 'rotina', 'segredo', HttpFalso([RespostaFalsa(401, {'erro': 'Usuario ou senha incorretos'})]))
        with self.assertRaises(RuntimeError) as ctx:
            p.entrar()
        self.assertNotIn('segredo', str(ctx.exception))

    def test_listar_e_atualizar_usam_o_token(self):
        http = HttpFalso([RespostaFalsa(200, {'token': 't'}), RespostaFalsa(200, {'conteudos': [{'id': 1}]}), RespostaFalsa(200, {'ok': True})])
        p = rm.Painel('https://exemplo.com', 'r', 's', http)
        p.entrar()
        self.assertEqual(p.listar('gravado'), [{'id': 1}])
        p.atualizar(1, {'sugestao_data': '2026-11-03'})
        self.assertEqual(http.chamadas[1][2]['headers'], {'Authorization': 'Bearer t'})
        self.assertEqual(http.chamadas[1][2]['params'], {'acao': 'conteudo_listar', 'status': 'gravado'})
        self.assertEqual(http.chamadas[2][2]['json'], {'sugestao_data': '2026-11-03', 'id': 1})
        self.assertEqual(http.chamadas[2][1], 'https://exemplo.com/api/painel?acao=conteudo_atualizar')


if __name__ == '__main__':
    unittest.main()
