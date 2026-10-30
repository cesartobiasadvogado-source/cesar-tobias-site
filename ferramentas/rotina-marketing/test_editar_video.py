"""Roda com: python -m unittest ferramentas/rotina-marketing/test_editar_video.py -v
(ou, dentro da pasta: python -m unittest test_editar_video -v)"""
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import editar_video as ev

TEM_FFMPEG = shutil.which('ffmpeg') and shutil.which('ffprobe')

SAIDA_DETECT = """
[silencedetect @ 0x1] silence_start: 2.0
[silencedetect @ 0x1] silence_end: 4.5 | silence_duration: 2.5
[silencedetect @ 0x1] silence_start: 8
"""


class Parse(unittest.TestCase):
    def test_pares_e_silencio_final_aberto(self):
        self.assertEqual(ev.parse_silencedetect(SAIDA_DETECT), [(2.0, 4.5), (8.0, None)])

    def test_inicio_negativo_vira_zero(self):
        self.assertEqual(ev.parse_silencedetect('silence_start: -0.02\nsilence_end: 1.0'), [(0.0, 1.0)])


class Trechos(unittest.TestCase):
    def test_inverte_silencios_com_folga(self):
        t = ev.calcular_trechos([(2.0, 4.5)], 10.0, folga=0.1)
        self.assertEqual([(round(i, 2), round(f, 2)) for i, f in t], [(0.0, 2.1), (4.4, 10.0)])

    def test_silencio_final_aberto_corta_ate_o_fim(self):
        t = ev.calcular_trechos([(8.0, None)], 10.0, folga=0.1)
        self.assertEqual([(round(i, 2), round(f, 2)) for i, f in t], [(0.0, 8.1)])

    def test_trechos_colados_pela_folga_se_juntam(self):
        t = ev.calcular_trechos([(1.0, 1.1), (1.2, 1.3)], 3.0, folga=0.2)
        self.assertEqual(len(t), 1)

    def test_video_todo_mudo_nao_vira_video_vazio(self):
        self.assertEqual(ev.calcular_trechos([(0.0, None)], 5.0), [(0.0, 5.0)])

    def test_trecho_curto_demais_e_descartado(self):
        t = ev.calcular_trechos([(0.0, 3.0), (3.1, 6.0)], 6.0, folga=0.0, trecho_min=0.25)
        self.assertEqual(t, [(0.0, 6.0)])  # so sobra um estalo de 0,1 s: devolve o video inteiro

    def test_duracao_invalida(self):
        with self.assertRaises(ValueError):
            ev.calcular_trechos([], 0)


class Filtro(unittest.TestCase):
    def test_usa_um_trim_por_trecho_e_normaliza_o_audio(self):
        f = ev.montar_filtro([(0, 1), (2, 3)])
        self.assertEqual(f.count('trim=start'), 4)  # 2 de video + 2 de audio
        self.assertIn('concat=n=2:v=1:a=1', f)
        self.assertIn('loudnorm', f)
        self.assertIn('crop=1080:1920', f)
        self.assertNotIn('subtitles', f)

    def test_legenda_escapa_o_caminho_do_windows(self):
        f = ev.montar_filtro([(0, 1)], legenda='C:\\temp\\fala.srt')
        self.assertIn("subtitles='C\\:/temp/fala.srt'", f)

    def test_sem_audio_nao_referencia_audio(self):
        f = ev.montar_filtro([(0, 1)], tem_audio=False)
        self.assertNotIn('[0:a]', f)
        self.assertNotIn('loudnorm', f)


@unittest.skipUnless(TEM_FFMPEG, 'sem ffmpeg')
class PontaAPonta(unittest.TestCase):
    """Gera um video de 6 s: 1 s de tom, 3 s de silencio, 2 s de tom, e edita de verdade."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        cls.bruto = cls.tmp / 'bruto' / 'teste.mp4'
        cls.bruto.parent.mkdir()
        subprocess.run([
            'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
            '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=6',
            '-f', 'lavfi', '-i',
            "aevalsrc='if(lt(t,1)+between(t,4,6),0.5*sin(2*PI*440*t),0)':s=44100:d=6",
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', str(cls.bruto)], check=True)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_planejar_nao_escreve_nada(self):
        saida = self.tmp / 'plano'
        plano = ev.editar(self.bruto, saida, so_planejar=True)
        self.assertLess(plano['duracao_final'], plano['duracao_original'] - 1.5)
        self.assertEqual(list(saida.glob('*')), [])

    def test_edita_corta_o_silencio_e_gera_vertical_e_capas(self):
        saida = self.tmp / 'editados'
        plano = ev.editar(self.bruto, saida)
        arq = saida / 'teste_editado.mp4'
        self.assertTrue(arq.is_file())
        self.assertTrue((saida / 'teste_capa_instagram.jpg').is_file())
        self.assertTrue((saida / 'teste_capa_tiktok.jpg').is_file())
        r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                            'stream=width,height:format=duration', '-of', 'csv=p=0', str(arq)],
                           capture_output=True, text=True)
        self.assertIn('1080,1920', r.stdout.replace('\n', ','))
        self.assertLess(float(r.stdout.strip().split('\n')[-1]), 5.0)
        self.assertEqual(self.bruto.stat().st_size > 0, True)  # original intacto
        self.assertGreater(plano['duracao_original'], plano['duracao_final'])

    def test_gera_json_de_arquivos_com_miniatura_que_o_painel_aceita(self):
        import base64
        import json
        saida = self.tmp / 'com-json'
        ev.editar(self.bruto, saida)
        dados = json.loads((saida / 'teste_arquivos.json').read_text(encoding='utf-8'))
        self.assertEqual(sorted(dados), ['instagram', 'tiktok'])
        for rede, item in dados.items():
            self.assertEqual(item['video'], 'teste_editado.mp4')
            self.assertEqual(item['capa'], 'teste_capa_%s.jpg' % rede)
            mini = item['miniatura']
            # regras do painel (marketing.py): JPEG em base64 e no maximo 30000 caracteres
            self.assertTrue(mini.startswith('data:image/jpeg;base64,'))
            self.assertLessEqual(len(mini), 30000)
            self.assertEqual(base64.b64decode(mini.split(',', 1)[1])[:3], b'\xff\xd8\xff')  # e um JPEG de verdade

    def test_nao_sobrescreve(self):
        saida = self.tmp / 'duas-vezes'
        ev.editar(self.bruto, saida)
        with self.assertRaises(FileExistsError):
            ev.editar(self.bruto, saida)

    def test_recusa_gravar_na_pasta_do_original(self):
        with self.assertRaises(ValueError):
            ev.editar(self.bruto, self.bruto.parent)


if __name__ == '__main__':
    unittest.main()
