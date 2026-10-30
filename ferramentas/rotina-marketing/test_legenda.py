"""Roda com (dentro da pasta): python -m unittest test_legenda -v"""
import unittest

import legenda as lg

ROTEIRO = ('Olá, este é um teste rápido de gravação, de áudio e vídeo. O objetivo aqui não é decorar falas difíceis, '
           'mas encontrar um ritmo de fala natural, claro e seguro. Você sabia que o prazo para contestar começa na citação? '
           'Quando falamos de forma pausada, a mensagem chega com muito mais credibilidade. Teste finalizado com sucesso.')


class Legenda(unittest.TestCase):
    def test_gancho_e_a_pergunta_e_a_saudacao_fica_de_fora(self):
        texto = lg.sugerir_legenda('Prazo para contestar', ROTEIRO)
        primeira = texto.split('\n\n')[0]
        self.assertEqual(primeira, 'Você sabia que o prazo para contestar começa na citação?')
        self.assertNotIn('Olá', texto)

    def test_estrutura_gancho_corpo_chamada_aviso_e_hashtags(self):
        partes = lg.sugerir_legenda('Prazo para contestar', ROTEIRO).split('\n\n')
        self.assertEqual(len(partes), 5)
        self.assertEqual(partes[2], lg.CHAMADA_PADRAO)
        self.assertEqual(partes[3], lg.AVISO_PADRAO)
        self.assertTrue(partes[4].startswith('#'))
        self.assertLessEqual(len(partes[1].split('\n')), 2)

    def test_nunca_acrescenta_promessa_preco_ou_chamada_para_contratar(self):
        texto = lg.sugerir_legenda('Prazo', ROTEIRO).lower()
        for proibido in ('garant', 'melhor', 'grátis', 'gratis', 'desconto', 'contrate', 'whatsapp', 'preço', '100%'):
            self.assertNotIn(proibido, texto)

    def test_sem_pergunta_usa_a_primeira_frase_util(self):
        texto = lg.sugerir_legenda('Rescisão', 'Oi pessoal. A rescisão indireta acontece quando o patrão descumpre o contrato. O trabalhador pode pedir na Justiça.')
        self.assertTrue(texto.startswith('A rescisão indireta acontece quando o patrão descumpre o contrato.'))

    def test_pergunta_que_depende_do_contexto_nao_vira_gancho(self):
        texto = lg.sugerir_legenda('Prazo', 'Oi pessoal! Hoje vou falar do prazo para contestar a reclamação trabalhista. Ele começa a contar da audiência inicial? Depende do caso e da notificação.')
        self.assertTrue(texto.startswith('Hoje vou falar do prazo para contestar a reclamação trabalhista.'))
        self.assertNotIn('#pessoal', texto)

    def test_hashtags_sem_acento_sem_palavras_genericas_e_no_maximo_4(self):
        tags = lg.hashtags('Rescisão indireta', 'A rescisão indireta ocorre quando o empregador descumpre obrigações trabalhistas graves. Rescisão, empregador, trabalhistas.')
        self.assertLessEqual(len(tags), 4)
        self.assertEqual(tags[0], '#rescisao')                  # a mais frequente, sem acento
        self.assertTrue(all(t.startswith('#') and t == t.lower() and t.isascii() for t in tags))
        self.assertNotIn('#voce', tags)

    def test_frase_longa_e_cortada_sem_partir_palavra(self):
        longa = 'Esta é uma frase ' + 'muito comprida e cheia de palavras ' * 10 + 'que termina aqui.'
        gancho = lg.sugerir_legenda('Tema', longa).split('\n\n')[0]
        self.assertLessEqual(len(gancho), lg.LIMITE_GANCHO + 1)
        self.assertTrue(gancho.endswith('…'))
        self.assertNotIn('  ', gancho)

    def test_respeita_o_limite_de_2200_caracteres(self):
        gigante = ' '.join('Frase número %d sobre o assunto principal do vídeo de hoje.' % i for i in range(300))
        self.assertLessEqual(len(lg.sugerir_legenda('Tema', gigante)), lg.LIMITE_LEGENDA)

    def test_sem_roteiro_usa_o_titulo_e_sem_nada_devolve_vazio(self):
        self.assertTrue(lg.sugerir_legenda('Prazo para contestar a reclamação', '').startswith('Prazo para contestar a reclamação'))
        self.assertEqual(lg.sugerir_legenda('', ''), '')
        self.assertEqual(lg.sugerir_legenda(None, None), '')

    def test_chamada_e_aviso_podem_ser_trocados_ou_omitidos(self):
        texto = lg.sugerir_legenda('Tema', ROTEIRO, chamada='', aviso='Texto fixo.')
        self.assertNotIn(lg.CHAMADA_PADRAO, texto)
        self.assertIn('Texto fixo.', texto)

    def test_o_roteiro_do_video_de_teste_gera_algo_revisavel(self):
        texto = lg.sugerir_legenda('TESTE - gravação de áudio e vídeo (pode apagar)', ROTEIRO)
        self.assertGreater(len(texto), 80)
        self.assertEqual(texto, lg.sugerir_legenda('TESTE - gravação de áudio e vídeo (pode apagar)', ROTEIRO))   # estavel


if __name__ == '__main__':
    unittest.main()
