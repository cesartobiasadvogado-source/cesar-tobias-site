"""Roda com (dentro da pasta): python -m unittest test_publicar_metricool -v   (sem internet, sem Metricool de verdade)"""
import json
import shutil
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import metricool_mcp as mm
import publicar_metricool as pm
import tunel_temporario as tt

TZ = timezone(timedelta(hours=-3))
AGORA = datetime(2026, 11, 1, 12, 0, tzinfo=TZ).timestamp()          # 01/11/2026 12:00 em Fortaleza
CFG = pm.configurar({'metricool': {'ativo': True, 'marca_id': 6492833, 'modo': 'rascunho'}})
LINK = 'https://app.metricool.com/planner/calendar?blogId=6492833&openWithPostUuid=U-55'


class PainelFalso:
    def __init__(self):
        self.atualizacoes = []

    def atualizar(self, i, campos):
        self.atualizacoes.append((i, campos))

    def estados(self):
        return [c['publicacao']['metricool'].get('status') for _, c in self.atualizacoes if 'metricool' in c.get('publicacao', {})]


class ClienteFalso:
    def __init__(self, resposta=None, erro=None):
        self.chamadas, self.erro = [], erro
        self.resposta = resposta if resposta is not None else {'data': {'id': 55, 'uuid': 'U-55', 'plannerUrl': LINK}}

    def chamar(self, nome, args):
        self.chamadas.append((nome, args))
        if self.erro:
            raise self.erro
        return self.resposta


class TunelFalso:
    historico = []
    falha = None

    def __init__(self, arquivo, **kw):
        self.arquivo = arquivo

    def __enter__(self):
        if TunelFalso.falha:
            raise TunelFalso.falha
        TunelFalso.historico.append('aberto:' + Path(self.arquivo).name)
        return 'https://abc.trycloudflare.com/TOKEN/video.mp4'

    def __exit__(self, *a):
        TunelFalso.historico.append('fechado')
        return False


def conteudo(**kw):
    base = {'id': 4, 'titulo': 'Prazo', 'status': 'agendado', 'redes': ['instagram', 'tiktok', 'facebook'],
            'data_postagem': '2026-11-02', 'hora_postagem': '18:30:00', 'arquivos': {'instagram': {'video': 'v.mp4'}},
            'publicacao': {'legenda': 'Texto do post.\n\n#prazo', 'revisada': True, 'programar': True}}
    pub = kw.pop('publicacao', None)
    base.update(kw)
    if pub is not None:
        base['publicacao'] = pub
    return base


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        (self.tmp / 'v.mp4').write_bytes(b'video')
        self.painel, self.cliente = PainelFalso(), ClienteFalso()
        TunelFalso.historico, TunelFalso.falha = [], None

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def programador(self, cfg=None, cliente=None, agora=AGORA):
        cli = cliente or self.cliente
        return pm.Programador(self.painel, lambda: cli, TunelFalso, cfg or CFG, self.tmp, lambda: agora, log=lambda *_: None)


class MontagemDoPedido(Base):
    def test_rascunho_vira_draft_sem_publicacao_automatica_e_so_leva_dados_das_redes_escolhidas(self):
        info = pm.montar_info('Legenda', 'https://x/v.mp4', datetime(2026, 11, 2, 18, 30), ['instagram', 'tiktok'], 'rascunho', 'America/Fortaleza', 'SELF_ONLY')
        self.assertEqual((info['draft'], info['autoPublish']), (True, False))
        self.assertEqual([p['network'] for p in info['providers']], ['instagram', 'tiktok'])
        self.assertIn('instagramData', info)
        self.assertIn('tiktokData', info)
        self.assertNotIn('facebookData', info)                                   # rede nao marcada: sem dados dela
        self.assertEqual(info['tiktokData']['privacyOption'], 'SELF_ONLY')
        self.assertEqual(info['publicationDate'], {'dateTime': '2026-11-02T18:30:00', 'timezone': 'America/Fortaleza'})
        self.assertEqual(info['media'], ['https://x/v.mp4'])
        self.assertNotIn('videoThumbnailUrl', info)                              # capa pode fazer o Metricool recusar tudo

    def test_automatico_agenda_e_deixa_o_metricool_publicar(self):
        info = pm.montar_info('L', 'u', datetime(2026, 11, 2, 18, 30), ['facebook'], 'automatico', 'America/Fortaleza', 'PUBLIC_TO_EVERYONE')
        self.assertEqual((info['draft'], info['autoPublish']), (False, True))
        self.assertEqual(info['facebookData'], {'type': 'REEL'})

    def test_titulo_do_tiktok_e_a_primeira_linha_cortada_em_90(self):
        info = pm.montar_info('x' * 200 + '\n\nresto', 'u', datetime(2026, 11, 2, 18, 30), ['tiktok'], 'rascunho', 'America/Fortaleza', 'SELF_ONLY')
        self.assertEqual(len(info['tiktokData']['title']), 90)

    def test_so_instagram_tiktok_e_facebook_sao_programaveis(self):
        self.assertEqual(pm.redes_programaveis({'redes': ['stories', 'tiktok', 'whatsapp', 'instagram', 'youtube']}), ['tiktok', 'instagram'])

    def test_modo_invalido_e_recusado_na_configuracao(self):
        with self.assertRaises(ValueError):
            pm.configurar({'metricool': {'modo': 'publicar_tudo'}})
        self.assertEqual(pm.configurar({})['modo'], 'rascunho')                  # padrao seguro


class CaminhoFeliz(Base):
    def test_rascunho_grava_enviando_antes_e_o_resultado_depois_e_fecha_o_tunel(self):
        r = self.programador().processar(conteudo())
        self.assertEqual(r[0], 'rascunho')
        self.assertEqual(self.painel.estados(), ['enviando', 'rascunho'])        # "enviando" ANTES da chamada
        (nome, args), = self.cliente.chamadas
        self.assertEqual((nome, args['blogId'], args['date']), ('createScheduledPost', '6492833', '2026-11-02T18:30:00-03:00'))
        info = json.loads(args['info'])
        self.assertEqual(info['media'], ['https://abc.trycloudflare.com/TOKEN/video.mp4'])
        self.assertEqual(info['text'], 'Texto do post.\n\n#prazo')
        self.assertEqual([p['network'] for p in info['providers']], ['instagram', 'tiktok', 'facebook'])
        self.assertEqual(TunelFalso.historico, ['aberto:v.mp4', 'fechado'])
        final = self.painel.atualizacoes[-1][1]['publicacao']['metricool']
        self.assertEqual((final['uuid'], final['id'], final['plannerUrl'], final['em']), ('U-55', '55', LINK, '2026-11-02T18:30:00-03:00'))

    def test_automatico_grava_programado(self):
        cfg = pm.configurar({'metricool': {'marca_id': '1', 'modo': 'automatico'}})
        r = self.programador(cfg).processar(conteudo())
        self.assertEqual(r[0], 'programado')
        self.assertEqual(self.painel.estados(), ['enviando', 'programado'])
        self.assertEqual(json.loads(self.cliente.chamadas[0][1]['info'])['autoPublish'], True)

    def test_nunca_manda_status_data_ou_arquivos_do_conteudo_so_a_publicacao(self):
        self.programador().processar(conteudo())
        for _, campos in self.painel.atualizacoes:
            self.assertEqual(list(campos), ['publicacao'])
            self.assertEqual(list(campos['publicacao']), ['metricool'])           # nao toca na legenda que a pessoa revisou

    def test_link_que_nao_e_do_metricool_e_descartado(self):
        cli = ClienteFalso({'data': {'id': 1, 'uuid': 'U', 'plannerUrl': 'https://evil.example/x'}})
        self.programador(cliente=cli).processar(conteudo())
        self.assertNotIn('plannerUrl', self.painel.atualizacoes[-1][1]['publicacao']['metricool'])


class SoAgeComTudoCombinado(Base):
    def _nada(self, c):
        self.assertIsNone(self.programador().processar(c))
        self.assertEqual((self.painel.atualizacoes, self.cliente.chamadas, TunelFalso.historico), ([], [], []))

    def test_conteudo_ainda_nao_aprovado_nao_e_tocado(self):
        self._nada(conteudo(status='gravado'))

    def test_sem_marcar_programar_nao_e_tocado(self):
        self._nada(conteudo(publicacao={'legenda': 'L', 'revisada': True, 'programar': False}))

    def test_sem_revisar_a_legenda_nao_e_tocado(self):
        self._nada(conteudo(publicacao={'legenda': 'L', 'revisada': False, 'programar': True}))

    def test_legenda_vazia_nao_e_tocado(self):
        self._nada(conteudo(publicacao={'legenda': '   ', 'revisada': True, 'programar': True}))

    def test_servidor_antigo_sem_o_campo_publicacao_nao_e_tocado(self):
        c = conteudo()
        del c['publicacao']
        self._nada(c)

    def test_ja_programado_ou_rascunho_nao_programa_de_novo(self):
        for status in ('programado', 'rascunho'):
            self._nada(conteudo(publicacao={'legenda': 'L', 'revisada': True, 'programar': True, 'metricool': {'status': status, 'uuid': 'U'}}))

    def test_erro_so_e_refeito_quando_a_pessoa_limpa_o_estado(self):
        c = conteudo(publicacao={'legenda': 'L', 'revisada': True, 'programar': True, 'metricool': {'status': 'erro', 'erro': 'x'}})
        self._nada(c)
        c['publicacao']['metricool'] = {}                                          # "Tentar de novo" no painel
        self.assertEqual(self.programador().processar(c)[0], 'rascunho')


class Recusas(Base):
    def test_horario_que_ja_passou_ou_esta_perto_demais_vira_erro_sem_chamar_o_metricool(self):
        for hora in ('2026-11-01', '11:00:00'), ('2026-11-01', '12:10:00'):
            self.painel.atualizacoes.clear()
            r = self.programador().processar(conteudo(data_postagem=hora[0], hora_postagem=hora[1]))
            self.assertEqual(r[0], 'erro')
            self.assertIn('menos de 15 minutos', r[1])
        self.assertEqual((self.cliente.chamadas, TunelFalso.historico), ([], []))

    def test_exatamente_na_antecedencia_minima_passa(self):
        self.assertEqual(self.programador().processar(conteudo(data_postagem='2026-11-01', hora_postagem='12:15:00'))[0], 'rascunho')

    def test_sem_rede_programavel_sem_horario_ou_sem_video_viram_erro(self):
        self.assertIn('Nenhuma das redes', self.programador().processar(conteudo(redes=['youtube', 'stories']))[1])
        self.assertIn('dia e a hora', self.programador().processar(conteudo(hora_postagem=None))[1])
        self.assertIn('2-Editados', self.programador().processar(conteudo(arquivos={'instagram': {'video': 'sumiu.mp4'}}))[1])
        self.assertEqual((self.cliente.chamadas, TunelFalso.historico), ([], []))


class Falhas(Base):
    def test_o_metricool_recusar_e_erro_definitivo_com_o_motivo(self):
        cli = ClienteFalso(erro=mm.RecusaMetricool('o Metricool recusou: limite de 20 posts do mes'))
        r = self.programador(cliente=cli).processar(conteudo())
        self.assertEqual(r[0], 'erro')
        self.assertIn('limite de 20 posts do mes', r[1])
        self.assertNotIn('Confira no Metricool', r[1])                              # recusa explicita: nada foi criado
        self.assertEqual(self.painel.estados(), ['enviando', 'erro'])
        self.assertEqual(TunelFalso.historico[-1], 'fechado')

    def test_falha_de_rede_depois_da_chamada_manda_conferir_no_metricool_antes_de_repetir(self):
        cli = ClienteFalso(erro=TimeoutError('lento'))
        r = self.programador(cliente=cli).processar(conteudo())
        self.assertIn('Confira no Metricool se o post foi criado', r[1])

    def test_falha_do_tunel_diz_que_nada_foi_enviado_e_nao_chama_o_metricool(self):
        TunelFalso.falha = tt.ErroTunel('o cloudflared nao devolveu o endereco')
        r = self.programador().processar(conteudo())
        self.assertIn('nada foi enviado', r[1])
        self.assertEqual(self.cliente.chamadas, [])

    def test_falha_antes_de_falar_com_o_metricool_diz_que_nada_foi_enviado(self):
        def quebra():
            raise mm.ErroMetricool('Metricool ainda nao autorizado: rode autorizar_metricool.py')
        p = pm.Programador(self.painel, quebra, TunelFalso, CFG, self.tmp, lambda: AGORA, log=lambda *_: None)
        r = p.processar(conteudo())
        self.assertIn('nada foi enviado', r[1])
        self.assertIn('autorizar_metricool.py', r[1])

    def test_resposta_estranha_nao_vira_sucesso(self):
        r = self.programador(cliente=ClienteFalso('so texto')).processar(conteudo())
        self.assertEqual(r[0], 'erro')

    def test_rodada_que_morreu_no_meio_deixa_enviando_e_a_proxima_nao_repete_a_chamada(self):
        c = conteudo(publicacao={'legenda': 'L', 'revisada': True, 'programar': True, 'metricool': {'status': 'enviando'}})
        r = self.programador().processar(c)
        self.assertEqual(r[0], 'erro')
        self.assertIn('interrompida', r[1])
        self.assertEqual((self.cliente.chamadas, TunelFalso.historico), ([], []))

    def test_um_conteudo_com_falha_nao_trava_os_outros(self):
        class Quebra(PainelFalso):
            def atualizar(s, i, campos):
                if i == 1:
                    raise RuntimeError('painel fora do ar')
                super().atualizar(i, campos)
        painel = Quebra()
        prog = pm.Programador(painel, lambda: self.cliente, TunelFalso, CFG, self.tmp, lambda: AGORA, log=lambda *_: None)
        feitos = pm.programar_pendentes(prog, [conteudo(id=1), conteudo(id=2)])
        self.assertEqual([f['resultado'] for f in feitos], ['falha', 'rascunho'])
        self.assertEqual(len(self.cliente.chamadas), 1)                              # o 1 nao chegou a chamar o Metricool


class Legendas(Base):
    def test_sugere_para_conteudo_pronto_sem_legenda_e_marca_como_nao_revisada(self):
        c = conteudo(status='gravado', roteiro='Você sabia que o prazo começa na citação? Depende do caso e da notificação recebida.', publicacao={})
        feitos = pm.sugerir_legendas(self.painel, [c], {}, log=lambda *_: None)
        self.assertEqual(len(feitos), 1)
        (i, campos), = self.painel.atualizacoes
        pub = campos['publicacao']
        self.assertEqual(sorted(pub), ['legenda', 'legenda_sugerida', 'revisada'])
        self.assertTrue(pub['legenda_sugerida'])
        self.assertFalse(pub['revisada'])                                           # a rotina nunca revisa por voce
        self.assertNotIn('programar', pub)                                           # nem decide programar

    def test_nunca_sobrescreve_legenda_existente_nem_toca_conteudo_sem_video_ou_servidor_antigo(self):
        com = conteudo(publicacao={'legenda': 'minha legenda'}, roteiro='Frase com bastante palavras aqui.')
        sem_video = conteudo(arquivos={}, publicacao={})
        antigo = conteudo(roteiro='Frase com bastante palavras aqui.')
        del antigo['publicacao']
        em_edicao = conteudo(status='para_gravar', publicacao={}, roteiro='Frase com bastante palavras aqui.')
        pm.sugerir_legendas(self.painel, [com, sem_video, antigo, em_edicao], {}, log=lambda *_: None)
        self.assertEqual(self.painel.atualizacoes, [])

    def test_chamada_e_aviso_vem_da_configuracao(self):
        c = conteudo(status='gravado', roteiro='Frase com bastante palavras para a legenda.', publicacao={})
        pm.sugerir_legendas(self.painel, [c], {'chamada_final': 'Minha chamada.', 'aviso_final': 'Meu aviso.'}, log=lambda *_: None)
        texto = self.painel.atualizacoes[0][1]['publicacao']['legenda']
        self.assertIn('Minha chamada.', texto)
        self.assertIn('Meu aviso.', texto)


class PainelDaRodada:
    """Painel de mentira para `executar`: lista por status, registra o que foi gravado."""
    def __init__(self, gravados=(), agendados=()):
        self.por_status = {'gravado': list(gravados), 'agendado': list(agendados)}
        self.atualizacoes, self.entrou = [], 0

    def entrar(self):
        self.entrou += 1

    def listar(self, status):
        return [dict(c) for c in self.por_status.get(status, [])]

    def atualizar(self, i, campos):
        self.atualizacoes.append((i, campos))


class NaRodadaDaRotina(unittest.TestCase):
    def setUp(self):
        import rotina_marketing as rm
        self.rm = rm
        self.tmp = Path(tempfile.mkdtemp())
        (self.tmp / '1-Brutos').mkdir()
        (self.tmp / '2-Editados').mkdir()
        (self.tmp / '2-Editados' / 'v.mp4').write_bytes(b'video')
        self.cliente = ClienteFalso()
        TunelFalso.historico, TunelFalso.falha = [], None

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def rodar(self, painel, **extra):
        config = dict({'pasta_base': str(self.tmp)}, **extra)
        deps = self.rm.Dependencias(painel, agora=lambda: AGORA, metricool=lambda: self.cliente, tunel=TunelFalso)
        return self.rm.executar(config, deps, log=lambda *_: None)

    def test_sem_pedir_nada_na_configuracao_nem_entra_no_painel(self):
        painel = PainelDaRodada([conteudo(status='gravado')])
        self.rodar(painel)
        self.assertEqual((painel.entrou, painel.atualizacoes, self.cliente.chamadas), (0, [], []))

    def test_modo_invalido_na_configuracao_para_com_erro_claro(self):
        with self.assertRaises(ValueError):
            self.rodar(PainelDaRodada(), metricool={'ativo': True, 'modo': 'qualquer'})

    def test_rodada_completa_sugere_a_legenda_e_programa_so_o_que_foi_aprovado_e_revisado(self):
        pronto = conteudo(id=1, status='gravado', roteiro='Você sabia que o prazo começa na citação? Depende do caso e da notificação.', publicacao={})
        aprovado = conteudo(id=2)                                                  # agendado + revisada + programar
        painel = PainelDaRodada([pronto], [aprovado])
        rel = self.rodar(painel, legenda_sugerida=True, metricool={'ativo': True, 'marca_id': '6492833', 'modo': 'rascunho'})
        self.assertEqual([x['id'] for x in rel['legendas']], [1])
        self.assertEqual([(x['id'], x['resultado']) for x in rel['programados']], [(2, 'rascunho')])
        self.assertEqual(len(self.cliente.chamadas), 1)                            # so o aprovado foi ao Metricool
        legenda_gravada = [c for i, c in painel.atualizacoes if i == 1][0]['publicacao']
        self.assertTrue(legenda_gravada['legenda_sugerida'])
        self.assertEqual(rel['erros'], [])

    def test_legenda_sugerida_sozinha_nao_programa_nada(self):
        painel = PainelDaRodada([conteudo(id=1, status='gravado', roteiro='Frase com varias palavras para a legenda sugerida.', publicacao={})])
        rel = self.rodar(painel, legenda_sugerida=True)
        self.assertEqual(len(rel['legendas']), 1)
        self.assertEqual((rel['programados'], self.cliente.chamadas), ([], []))

    def test_falha_na_programacao_nao_derruba_a_rodada_e_vai_para_o_relatorio(self):
        def quebra():
            raise RuntimeError('sem internet')
        config = {'pasta_base': str(self.tmp), 'metricool': {'ativo': True, 'marca_id': '1'}}
        deps = self.rm.Dependencias(PainelDaRodada([], [conteudo()]), agora=lambda: AGORA, metricool=quebra, tunel=TunelFalso)
        rel = self.rm.executar(config, deps, log=lambda *_: None)
        self.assertEqual(rel['programados'][0]['resultado'], 'erro')               # virou erro NO CARTAO, nao excecao

    def test_sem_fabrica_do_cliente_e_um_erro_registrado_e_nao_uma_excecao(self):
        deps = self.rm.Dependencias(PainelDaRodada([], [conteudo()]), agora=lambda: AGORA)
        rel = self.rm.executar({'pasta_base': str(self.tmp), 'metricool': {'ativo': True, 'marca_id': '1'}}, deps, log=lambda *_: None)
        self.assertEqual(rel['erros'][0]['video'], '(legenda/Metricool)')


if __name__ == '__main__':
    unittest.main()
