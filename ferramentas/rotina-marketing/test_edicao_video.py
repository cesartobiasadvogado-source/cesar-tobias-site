"""Roda com (dentro da pasta): python -m unittest test_edicao_video -v   (sem ffmpeg, sem rede)"""
import json
import random
import tempfile
import unittest
from pathlib import Path

import edicao_video as ed

# trecho real do seu video de teste (IMG_2713): lacunas de 0,5 s e de 2,7 s
PALAVRAS = [(2.06, 2.54, 'Olá,'), (3.04, 3.24, 'este'), (3.24, 3.36, 'é'), (3.36, 3.42, 'um'),
            (3.42, 3.58, 'teste'), (3.58, 4.00, 'rápido'), (4.00, 4.22, 'de'), (4.22, 4.82, 'gravação,'),
            (11.62, 12.10, 'Repare'), (12.10, 12.30, 'a'), (15.0, 15.4, 'ruído.'), (18.12, 18.50, 'Quando')]


class Trechos(unittest.TestCase):
    def test_corta_o_silencio_do_comeco_e_as_lacunas_grandes_e_guarda_a_folga(self):
        t = ed.trechos_por_palavras(PALAVRAS, 20.0)
        # 1a palavra em 2,06 -> comeca 0,25 antes; lacuna 2,54->3,04 (0,5 s) e cortada deixando 0,12 de cada lado
        self.assertAlmostEqual(t[0][0], 1.81, places=2)
        self.assertAlmostEqual(t[0][1], 2.66, places=2)
        self.assertAlmostEqual(t[1][0], 2.92, places=2)
        self.assertGreater(len(t), 3)

    def test_lacuna_pequena_nao_corta(self):
        t = ed.trechos_por_palavras([(1.0, 1.5, 'a'), (1.7, 2.0, 'b')], 5.0)
        self.assertEqual(len(t), 1)

    def test_sem_palavras_devolve_o_video_inteiro(self):
        self.assertEqual(ed.trechos_por_palavras([], 12.0), [(0.0, 12.0)])

    def test_duracao_invalida(self):
        with self.assertRaises(ValueError):
            ed.trechos_por_palavras(PALAVRAS, 0)

    def test_nao_ultrapassa_a_duracao_do_video(self):
        t = ed.trechos_por_palavras([(0.1, 9.9, 'tudo')], 10.0)
        self.assertEqual(t[0][0], 0.0)
        self.assertLessEqual(t[-1][1], 10.0)

    def test_o_video_editado_fica_mais_curto(self):
        self.assertLess(ed.duracao_final(ed.trechos_por_palavras(PALAVRAS, 20.0)), 20.0 - 8)

    def test_propriedade_nenhuma_palavra_cai_dentro_de_um_corte(self):
        rnd = random.Random(7)
        for _ in range(300):
            t, ps = 0.5, []
            for _ in range(rnd.randint(1, 40)):
                t += rnd.choice([0.0, 0.02, 0.1, 0.3, 0.45, 0.9, 2.5])
                dur = rnd.uniform(0.05, 0.7)
                ps.append((t, t + dur, 'p'))
                t += dur
            duracao = t + rnd.uniform(0.0, 3.0)
            trechos = ed.trechos_por_palavras(ps, duracao)
            for ini_p, fim_p, _ in ps:
                self.assertTrue(any(i <= ini_p + 1e-9 and fim_p <= f + 1e-9 for i, f in trechos),
                                'palavra %.2f-%.2f cortada em %s' % (ini_p, fim_p, trechos))
            self.assertTrue(all(a[1] <= b[0] for a, b in zip(trechos, trechos[1:])))  # sem sobreposicao


class Remapeamento(unittest.TestCase):
    def test_palavras_seguem_o_video_cortado_e_ficam_dentro_da_nova_duracao(self):
        trechos = ed.trechos_por_palavras(PALAVRAS, 20.0)
        novas = ed.remapear_palavras(PALAVRAS, trechos)
        self.assertEqual([p[2] for p in novas], [p[2] for p in PALAVRAS])
        total = ed.duracao_final(trechos)
        self.assertTrue(all(0 <= i < f <= total + 1e-6 for i, f, _ in novas))
        self.assertAlmostEqual(novas[0][0], 0.25, places=2)  # a 1a palavra abre o video com a entrada de 0,25 s
        self.assertTrue(all(a[0] <= b[0] for a, b in zip(novas, novas[1:])))

    def test_palavra_na_area_cortada_some(self):
        novas = ed.remapear_palavras([(1.0, 1.2, 'fica'), (5.0, 5.2, 'sai')], [(0.5, 2.0)])
        self.assertEqual([p[2] for p in novas], ['fica'])

    def test_palavra_na_borda_e_recortada(self):
        novas = ed.remapear_palavras([(1.8, 2.4, 'borda')], [(0.0, 2.0)])
        self.assertAlmostEqual(novas[0][1], 2.0)


class Linhas(unittest.TestCase):
    def test_quebra_em_pontuacao_final(self):
        ls = ed.agrupar_linhas([(0, 1, 'Oi'), (1, 2, 'tudo.'), (2, 3, 'Bem')])
        self.assertEqual([[p[2] for p in l] for l in ls], [['Oi', 'tudo.'], ['Bem']])

    def test_limite_de_palavras_e_de_caracteres(self):
        ls = ed.agrupar_linhas([(i, i + 1, 'ab') for i in range(9)])
        self.assertTrue(all(len(l) <= ed.MAX_PALAVRAS_LINHA for l in ls))
        ls = ed.agrupar_linhas([(0, 1, 'palavralonga'), (1, 2, 'outrapalavra'), (2, 3, 'terceira')])
        self.assertTrue(all(len(' '.join(p[2] for p in l)) <= ed.MAX_CARACTERES_LINHA for l in ls))

    def test_quebra_em_pausa_longa(self):
        ls = ed.agrupar_linhas([(0, 1, 'a'), (3, 4, 'b')])
        self.assertEqual(len(ls), 2)

    def test_numero_com_ponto_nao_quebra_linha(self):
        ls = ed.agrupar_linhas([(0, 1, 'R$'), (1, 2, '6.000'), (2, 3, 'por')])
        self.assertEqual(len(ls), 1)


class LegendaAss(unittest.TestCase):
    P = [(0.25, 0.60, 'Olá,'), (0.60, 0.90, 'este'), (0.90, 1.40, 'é'), (1.40, 1.80, 'teste.')]

    def test_destaque_gera_um_evento_por_palavra_com_so_uma_colorida(self):
        ass = ed.gerar_ass(self.P, destaque=True)
        eventos = [l for l in ass.splitlines() if l.startswith('Dialogue:')]
        self.assertEqual(len(eventos), 4)
        for ev in eventos:
            self.assertEqual(ev.count(ed.COR_DESTAQUE), 1)
        self.assertIn('{\\c%s}Olá,{\\c%s} este é teste.' % (ed.COR_DESTAQUE, ed.COR_BASE), eventos[0])

    def test_sem_destaque_e_uma_linha_inteira_por_grupo(self):
        ass = ed.gerar_ass(self.P, destaque=False)
        eventos = [l for l in ass.splitlines() if l.startswith('Dialogue:')]
        self.assertEqual(len(eventos), 1)
        self.assertNotIn(ed.COR_DESTAQUE, eventos[0])
        self.assertTrue(eventos[0].endswith('Olá, este é teste.'))

    def test_formato_de_tempo_e_cabecalho_do_quadro_vertical(self):
        ass = ed.gerar_ass(self.P)
        self.assertIn('PlayResX: 1080', ass)
        self.assertIn('PlayResY: 1920', ass)
        self.assertIn('Dialogue: 0,0:00:00.25,0:00:00.60,Fala', ass)
        self.assertEqual(ed._tempo_ass(3725.5), '1:02:05.50')

    def test_caracteres_especiais_do_ass_sao_removidos(self):
        ass = ed.gerar_ass([(0, 1, '{\\b1}oi}')], destaque=False)
        texto = [l for l in ass.splitlines() if l.startswith('Dialogue:')][0].split(',,')[-1]
        self.assertEqual(texto, 'b1oi')   # sem chaves nem barras: nada de codigo ASS vindo da fala

    def test_duas_legendas_nunca_ficam_na_tela_ao_mesmo_tempo(self):
        # frase termina e a proxima comeca logo em seguida (como depois de um corte)
        P = [(0.25, 0.6, 'de'), (0.6, 0.9, 'audio'), (0.9, 1.2, 'e'), (1.2, 1.6, 'video.'),
             (1.62, 1.9, 'O'), (1.9, 2.3, 'objetivo'), (2.3, 2.6, 'aqui'), (2.6, 3.0, 'nao')]
        for destaque in (True, False):
            ass = ed.gerar_ass(P, destaque=destaque)
            eventos = []
            for l in ass.splitlines():
                if l.startswith('Dialogue:'):
                    partes = l.split(',')
                    eventos.append((partes[1], partes[2]))
            eventos.sort()
            for (_, fim_a), (ini_b, _) in zip(eventos, eventos[1:]):
                self.assertLessEqual(fim_a, ini_b, 'legendas sobrepostas (destaque=%s): %s' % (destaque, eventos))

    def test_cada_evento_termina_depois_de_comecar(self):
        ass = ed.gerar_ass(self.P)
        for l in ass.splitlines():
            if l.startswith('Dialogue:'):
                partes = l.split(',')
                self.assertLess(partes[1], partes[2])


class LerPalavras(unittest.TestCase):
    def test_le_o_json_do_whisper_e_ignora_item_vazio(self):
        dados = {'segments': [{'words': [{'word': ' Olá,', 'start': 1.0, 'end': 1.4}, {'word': ' ', 'start': 1.4, 'end': 1.5},
                                         {'word': ' tudo', 'start': 1.5, 'end': 1.9}]}]}
        with tempfile.TemporaryDirectory() as tmp:
            arq = Path(tmp) / 'a.json'
            arq.write_text(json.dumps(dados), encoding='utf-8')
            self.assertEqual(ed.ler_palavras(arq), [(1.0, 1.4, 'Olá,'), (1.5, 1.9, 'tudo')])


if __name__ == '__main__':
    unittest.main()
