"""Programa no Metricool os posts que a pessoa APROVOU no painel (e sugere a legenda a partir do roteiro).

Regras que nao mudam (cada uma tem teste):
- So age sobre conteudo em "Agendado" (a aprovacao e da pessoa), com a legenda REVISADA e "Programar no
  Metricool" marcado. Nada disso e decidido pela rotina.
- Nunca programa duas vezes: grava "enviando" ANTES de chamar o Metricool e o resultado DEPOIS. Se uma
  rodada morrer no meio, a seguinte nao repete: marca erro e manda a pessoa conferir no Metricool.
- Erro nunca e repetido sozinho: so a pessoa, apertando "Tentar de novo" no painel.
- Recusa horario que ja passou ou esta perto demais (padrao 15 min): nao tem como o Metricool publicar.
- So age se o servidor souber guardar a publicacao (campo `publicacao` presente): com servidor antigo nao
  ha onde registrar o resultado e o mesmo post seria programado de novo a cada rodada.
- Modo "rascunho" (padrao): cria um RASCUNHO no Metricool para a pessoa confirmar la. "automatico": agenda
  e o Metricool publica sozinho no horario.
"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import legenda as lg
import metricool_mcp as mm
import tunel_temporario as tt

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

REDES_PROGRAMAVEIS = ('instagram', 'tiktok', 'facebook')
MODOS = ('rascunho', 'automatico')
PADRAO = {'ativo': False, 'marca_id': '', 'modo': 'rascunho', 'fuso': 'America/Fortaleza', 'antecedencia_min': 15,
          'tiktok_privacidade': 'PUBLIC_TO_EVERYONE'}


def configurar(config):
    cfg = dict(PADRAO)
    cfg.update(config.get('metricool') or {})
    if cfg['modo'] not in MODOS:
        raise ValueError('modo do metricool invalido: %r (use "rascunho" ou "automatico")' % cfg['modo'])
    cfg['marca_id'] = str(cfg['marca_id'])
    return cfg


def fuso(nome):
    if ZoneInfo is not None:
        try:
            return ZoneInfo(nome)
        except Exception:
            pass
    return timezone(timedelta(hours=-3))      # Fortaleza: sem horario de verao desde 2019


def redes_programaveis(c):
    return [r for r in (c.get('redes') or []) if r in REDES_PROGRAMAVEIS]


def horario_do_post(c, tz):
    d, h = c.get('data_postagem'), c.get('hora_postagem')
    if not d or not h:
        return None
    return datetime.fromisoformat(str(d)[:10] + 'T' + str(h)[:8]).replace(tzinfo=tz)


def video_editado(c, editados):
    for rede in sorted(c.get('arquivos') or {}):
        nome = (c['arquivos'][rede] or {}).get('video')
        if nome and (Path(editados) / nome).is_file():
            return Path(editados) / nome
    return None


def tem_video_editado(c):
    return any((v or {}).get('video') for v in (c.get('arquivos') or {}).values())


def montar_info(legenda, url_video, quando, redes, modo, tz_nome, tiktok_privacidade):
    """O `info` do createScheduledPost do Metricool. So leva os dados das redes que estao em `providers`."""
    info = {'autoPublish': modo == 'automatico', 'draft': modo == 'rascunho', 'descendants': [], 'hasNotReadNotes': False,
            'firstCommentText': '', 'media': [url_video], 'mediaAltText': [], 'providers': [{'network': r} for r in redes],
            'publicationDate': {'dateTime': quando.strftime('%Y-%m-%dT%H:%M:%S'), 'timezone': tz_nome},
            'shortener': False, 'smartLinkData': {'ids': []}, 'text': legenda}
    if 'instagram' in redes:
        info['instagramData'] = {'type': 'REEL'}
    if 'facebook' in redes:
        info['facebookData'] = {'type': 'REEL'}
    if 'tiktok' in redes:
        info['tiktokData'] = {'privacyOption': tiktok_privacidade, 'title': legenda.split('\n')[0][:90], 'disableComment': False,
                              'disableDuet': False, 'disableStitch': False, 'commercialContentThirdParty': False,
                              'commercialContentOwnBrand': False, 'autoAddMusic': False, 'isAigc': False}
    return info


def sugerir_legendas(painel, conteudos, config, log=print):
    """Escreve a legenda SUGERIDA nos conteudos prontos (video editado) que ainda nao tem legenda. Nunca mexe
    numa legenda existente. Devolve [{'conteudo', 'id'}]."""
    feitos = []
    for c in conteudos:
        pub = c.get('publicacao')
        if pub is None:                                    # servidor sem suporte ainda
            continue
        if (pub.get('legenda') or '').strip() or not tem_video_editado(c) or c.get('status') not in ('gravado', 'agendado'):
            continue
        texto = lg.sugerir_legenda(c.get('titulo'), c.get('roteiro'), chamada=config.get('chamada_final', lg.CHAMADA_PADRAO),
                                   aviso=config.get('aviso_final', lg.AVISO_PADRAO))
        if not texto:
            continue
        painel.atualizar(c['id'], {'publicacao': {'legenda': texto, 'legenda_sugerida': True, 'revisada': False}})
        feitos.append({'conteudo': c.get('titulo'), 'id': c['id']})
        log('  legenda sugerida para "%s"' % c.get('titulo'))
    return feitos


class Programador:
    def __init__(self, painel, fabrica_cliente, tunel, cfg, editados, agora, log=print):
        self.painel, self.fabrica_cliente, self.tunel, self.cfg = painel, fabrica_cliente, tunel, cfg
        self.editados, self.agora, self.log = Path(editados), agora, log
        self.tz = fuso(cfg['fuso'])

    def _estado(self, c, **met):
        self.painel.atualizar(c['id'], {'publicacao': {'metricool': met}})

    def _erro(self, c, texto):
        self._estado(c, status='erro', erro=texto)
        self.log('  "%s": %s' % (c.get('titulo'), texto))
        return ('erro', texto)

    def processar(self, c):
        """Devolve (resultado, detalhe) ou None quando nao ha nada a fazer neste conteudo."""
        pub = c.get('publicacao')
        if pub is None:
            return None
        met = pub.get('metricool') or {}
        if met.get('status') == 'enviando':
            # a rodada anterior morreu entre "enviando" e o resultado: nao da para saber se o post existe
            return self._erro(c, 'A programação foi interrompida no meio. Confira no Metricool se o post já existe '
                                 'antes de tentar de novo, para não duplicar.')
        if met.get('status'):
            return None                                    # programado/rascunho: pronto; erro: so a pessoa refaz
        if (c.get('status') != 'agendado' or not pub.get('programar') or not pub.get('revisada')
                or not (pub.get('legenda') or '').strip()):
            return None
        redes = redes_programaveis(c)
        if not redes:
            return self._erro(c, 'Nenhuma das redes marcadas pode ser programada (só Instagram, TikTok e Facebook).')
        quando = horario_do_post(c, self.tz)
        if quando is None:
            return self._erro(c, 'Falta o dia e a hora da postagem.')
        agora = datetime.fromtimestamp(self.agora(), self.tz)
        if quando < agora + timedelta(minutes=self.cfg['antecedencia_min']):
            return self._erro(c, 'O horário já passou ou está a menos de %d minutos. Mude o horário e tente de novo.' % self.cfg['antecedencia_min'])
        video = video_editado(c, self.editados)
        if video is None:
            return self._erro(c, 'Não encontrei o vídeo editado na pasta 2-Editados.')

        iso = quando.isoformat()
        self._estado(c, status='enviando', em=iso, redes=redes)           # ANTES de chamar: protege contra duplicata
        chamou = False
        try:
            cliente = self.fabrica_cliente()
            with self.tunel(video) as url:
                info = montar_info(pub['legenda'], url, quando, redes, self.cfg['modo'], self.cfg['fuso'], self.cfg['tiktok_privacidade'])
                chamou = True
                resposta = cliente.chamar('createScheduledPost', {'blogId': self.cfg['marca_id'], 'date': iso, 'info': json.dumps(info)})
            dados = resposta.get('data') if isinstance(resposta, dict) else None
            if not isinstance(dados, dict) or not (dados.get('uuid') or dados.get('id')):
                raise mm.ErroMetricool('resposta inesperada do Metricool: %s' % str(resposta)[:120])
        except mm.RecusaMetricool as e:
            return self._erro(c, 'O Metricool recusou: %s' % str(e).replace('o Metricool recusou: ', '')[:230])
        except tt.ErroTunel as e:
            return self._erro(c, 'Não consegui abrir o endereço temporário do vídeo (nada foi enviado ao Metricool): %s' % str(e)[:170])
        except Exception as e:
            if not chamou:
                return self._erro(c, 'Falha antes de falar com o Metricool (nada foi enviado): %s' % str(e)[:200])
            return self._erro(c, 'Não deu para confirmar o envio (%s). Confira no Metricool se o post foi criado antes de tentar de novo.' % type(e).__name__)
        resultado = {'status': 'rascunho' if self.cfg['modo'] == 'rascunho' else 'programado', 'em': iso, 'redes': redes}
        if dados.get('uuid'):
            resultado['uuid'] = str(dados['uuid'])
        if dados.get('id') is not None:
            resultado['id'] = str(dados['id'])
        if str(dados.get('plannerUrl') or '').startswith('https://app.metricool.com/'):
            resultado['plannerUrl'] = dados['plannerUrl']
        self._estado(c, **resultado)
        self.log('  "%s": %s no Metricool para %s (%s)' % (c.get('titulo'), resultado['status'], iso, ', '.join(redes)))
        return (resultado['status'], resultado)


def programar_pendentes(programador, conteudos):
    """Roda `processar` em cada conteudo; um com problema nao trava os outros. Devolve a lista do que aconteceu."""
    feitos = []
    for c in conteudos:
        try:
            r = programador.processar(c)
        except Exception as e:
            feitos.append({'conteudo': c.get('titulo'), 'id': c.get('id'), 'resultado': 'falha', 'detalhe': str(e)[:200]})
            continue
        if r:
            feitos.append({'conteudo': c.get('titulo'), 'id': c.get('id'), 'resultado': r[0],
                           'detalhe': r[1] if isinstance(r[1], str) else {k: r[1].get(k) for k in ('em', 'redes', 'uuid')}})
    return feitos
