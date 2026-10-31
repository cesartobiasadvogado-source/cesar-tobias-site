"""Edita AGORA o video de um conteudo que a pessoa mandou editar no painel ("Editar video agora"), mostrando
o andamento (etapa e porcentagem) no cartao. Roda no vigia, no computador da pessoa (e onde estao o Whisper,
o ffmpeg e a pasta do Drive).

Regras que nao mudam (cada uma tem teste):
- So age em conteudo "Gravado" que a pessoa mandou editar (andamento.estado == "fila") e que ainda nao tem video.
- Nunca mexe no video original e nunca sobrescreve/apaga: se ja existe um editado com o mesmo nome, grava
  com outro nome (video_2_editado.mp4 ...).
- Nao edita ao mesmo tempo que a rotina das 08:30/17:30 (mesma trava `rodando.lock`).
- Um "rodando" que encontra no comeco de um ciclo e de uma execucao que morreu: vira erro (nunca fica
  parado para sempre) e so volta a rodar se a pessoa pedir de novo.
- Erro nunca e repetido sozinho.
"""
import contextlib
import json
import os
import subprocess
import time
from datetime import datetime
from pathlib import Path

import edicao_video as ed
import editar_video as ev
import publicar_metricool as pm
import rotina_marketing as rm

PCT_TRANSCRICAO = 25          # a transcricao ocupa 0-25%; a edicao 25-95%
INTERVALO_GRAVAR_S = 3


def agora_iso(t=None):
    return datetime.fromtimestamp(t if t is not None else time.time()).astimezone().isoformat(timespec='seconds')


def estado_andamento(c):
    return ((c.get('edicao') or {}).get('andamento') or {}).get('estado')


def _processo_vivo(pid):
    """True se existe um processo com esse numero (no Windows, pelo tasklist)."""
    try:
        r = subprocess.run(['tasklist', '/FI', 'PID eq %d' % pid, '/NH'], capture_output=True, text=True, timeout=15)
        return str(pid) in r.stdout
    except Exception:
        return True                                 # na duvida, nao rouba a trava


@contextlib.contextmanager
def trava_edicao(pasta_rotina, agora=time.time, velha_s=3 * 3600, processo_vivo=_processo_vivo):
    """Mesma trava da rotina (`rodando.lock`): so uma edicao por vez no computador. Quem pega escreve o
    proprio numero de processo; se esse processo morreu (queda de energia, vigia fechado), a trava e velha
    na hora. A trava da rotina (sem numero) so vence depois de 3 h."""
    arq = Path(pasta_rotina) / 'rodando.lock'
    arq.parent.mkdir(parents=True, exist_ok=True)
    pegou = False
    for _ in range(2):
        try:
            fd = os.open(str(arq), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode('ascii'))
            os.close(fd)
            pegou = True
            break
        except FileExistsError:
            try:
                dono = arq.read_text(encoding='ascii', errors='ignore').strip()
                morto = dono.isdigit() and not processo_vivo(int(dono))
                if not morto and agora() - arq.stat().st_mtime < velha_s:
                    break
                arq.unlink()
            except OSError:
                break
    try:
        yield pegou
    finally:
        if pegou:
            try:
                arq.unlink()
            except OSError:
                pass


class Andamento:
    """Grava o andamento dentro de `edicao.andamento`, sem perder as escolhas de edicao da pessoa."""

    def __init__(self, painel, c, relogio=time.time, log=print):
        self.painel, self.id, self.log, self.relogio = painel, c['id'], log, relogio
        self.edicao = dict(c.get('edicao') or {})
        self.inicio = agora_iso(relogio())
        self._ultimo = (None, None, 0.0)

    def mudar(self, estado, etapa, pct=None, erro=None, forcar=False):
        t = self.relogio()
        if not forcar and estado == 'rodando':
            if self._ultimo[:2] == (etapa, pct):
                return
            if t - self._ultimo[2] < INTERVALO_GRAVAR_S and self._ultimo[0] == etapa:
                return                      # nao martela o painel: no maximo uma atualizacao a cada poucos segundos
        andamento = {'estado': estado, 'etapa': (etapa or '')[:80], 'pct': pct, 'inicio': self.inicio, 'em': agora_iso(t)}
        if erro:
            andamento['erro'] = str(erro)[:300]
        self.edicao['andamento'] = andamento
        self._ultimo = (etapa, pct, t)
        try:
            self.painel.atualizar(self.id, {'edicao': dict(self.edicao)})
        except Exception as e:           # a edicao nao pode morrer porque o painel falhou numa atualizacao de barra
            self.log('  aviso: nao consegui atualizar o andamento no painel: %s' % e)


def achar_video(c, brutos, estado):
    """O video bruto do conteudo: o que a rotina ja achou; senao o unico da pasta; senao o que a fala indica."""
    existentes = [a for a in sorted(Path(brutos).iterdir())
                  if a.is_file() and a.suffix.lower() in rm.EXTENSOES and not a.name.startswith(('.', '~')) and a.stat().st_size > 0]
    nome = (c.get('edicao') or {}).get('video_encontrado')
    if nome:
        for a in existentes:
            if a.name == nome:
                return a
    if len(existentes) == 1:
        return existentes[0]
    if not existentes:
        raise RuntimeError('não há vídeo na pasta 1-Brutos')
    achados = []
    for a in existentes:
        item = estado.get(rm.chave_arquivo(a)) or {}
        if item.get('fala') and rm.escolher_correspondencia(item['fala'], [c], nome_video=a.stem)[0]:
            achados.append(a)
    if len(achados) == 1:
        return achados[0]
    raise RuntimeError('não sei qual vídeo de 1-Brutos é deste conteúdo: deixe só o vídeo dele na pasta e tente de novo')


def nome_livre(video, editados):
    """Nome-base que nao colide com um editado que ja existe (nunca sobrescreve)."""
    editados = Path(editados)
    for n in range(1, 50):
        base = video.stem if n == 1 else '%s_%d' % (video.stem, n)
        if not any((editados / (base + s)).exists() for s in ('_editado.mp4', '_arquivos.json', '_capa_instagram.jpg', '_capa_tiktok.jpg')):
            return base
    raise RuntimeError('já existem edições demais deste vídeo; apague as antigas em 2-Editados')


def editar_agora(c, config, painel, estado, transcrever=rm.transcrever_whisper, editar=ev.editar, relogio=time.time,
                 hoje=None, log=print):
    """Edita o video do conteudo `c`. Devolve ('pronto', None) ou ('erro', motivo). Nunca levanta."""
    base = Path(config['pasta_base'])
    brutos, editados = base / '1-Brutos', base / '2-Editados'
    barra = Andamento(painel, c, relogio, log)
    try:
        barra.mudar('rodando', 'Procurando o vídeo bruto', 1, forcar=True)
        video = achar_video(c, brutos, estado)
        chave = rm.chave_arquivo(video)
        item = estado.get(chave) or {}
        if 'fala' in item and Path(item.get('srt', '')).exists() and Path(item['srt']).with_suffix('.json').exists():
            fala, srt = item['fala'], Path(item['srt'])
        else:
            barra.mudar('rodando', 'Transcrevendo a fala (pode levar alguns minutos)', None, forcar=True)
            fala, srt = transcrever(video, base / '_rotina' / 'transcricoes')
            estado.marcar(chave, fala=fala, srt=str(srt), arquivo=video.name)
        barra.mudar('rodando', 'Fala transcrita', PCT_TRANSCRICAO, forcar=True)
        palavras = ed.ler_palavras(srt.with_suffix('.json'))
        nome = nome_livre(video, editados)

        def progresso(etapa, pct):
            barra.mudar('rodando', etapa, PCT_TRANSCRICAO + int(pct * 0.7))
        plano = editar(video, editados, opcoes=rm.opcoes_de_edicao(c.get('edicao')), palavras=palavras, nome_base=nome,
                       progresso=progresso)
        barra.mudar('rodando', 'Enviando o resultado para o painel', 97, forcar=True)
        dados_arq = json.loads(Path(plano['arquivos_json']).read_text(encoding='utf-8'))
        arquivos = rm.juntar_arquivos(c.get('arquivos'), dados_arq, c.get('redes'))
        campos = {'arquivos': arquivos}
        if not c.get('sugestao_data') and not c.get('data_postagem'):
            ocupados = rm.horarios_ocupados(painel.listar('gravado') + painel.listar('agendado'))
            dia = hoje() if hoje else datetime.now().date()
            data_s, hora_s = rm.proxima_sugestao(ocupados, dia, tuple(config.get('horarios', ['18:30'])),
                                                 tuple(config.get('dias_semana', [0, 1, 2, 3, 4, 5, 6])))
            if data_s:
                campos.update(sugestao_data=data_s, sugestao_hora=hora_s)
        barra.edicao['andamento'] = {'estado': 'pronto', 'etapa': 'Vídeo pronto', 'pct': 100, 'inicio': barra.inicio,
                                     'em': agora_iso(relogio())}
        campos['edicao'] = dict(barra.edicao)
        painel.atualizar(c['id'], campos)
        estado.marcar(chave, status='concluido', conteudo_id=c['id'], concluido_em=datetime.now().isoformat(timespec='seconds'))
        if config.get('legenda_sugerida'):
            try:
                pm.sugerir_legendas(painel, [dict(c, arquivos=arquivos, publicacao=c.get('publicacao') or {})], config, log=log)
            except Exception as e:
                log('  aviso: não consegui sugerir a legenda: %s' % e)
        log('  "%s": vídeo editado (%s)' % (c.get('titulo'), nome))
        return 'pronto', None
    except Exception as e:
        motivo = str(e)[:300] or e.__class__.__name__
        log('  "%s": ERRO na edição: %s' % (c.get('titulo'), motivo))
        try:
            barra.mudar('erro', 'Não foi possível editar', None, erro=motivo, forcar=True)
        except Exception:
            pass
        return 'erro', motivo


def ciclo_edicao(painel, config, estado=None, editar_fn=editar_agora, relogio=time.time, log=print, **dep):
    """Uma olhada: edita o que foi pedido e arruma o que ficou "rodando" de uma execucao que morreu."""
    base = Path(config['pasta_base'])
    feitos = []
    gravados = painel.listar('gravado')
    for c in gravados:
        if estado_andamento(c) == 'rodando':
            motivo = 'A edição foi interrompida (o computador desligou ou o vigia fechou). Clique em "Editar vídeo agora" para tentar de novo.'
            ed_nova = dict(c.get('edicao') or {})
            ed_nova['andamento'] = {'estado': 'erro', 'etapa': 'Edição interrompida', 'erro': motivo[:300], 'em': agora_iso(relogio())}
            painel.atualizar(c['id'], {'edicao': ed_nova})
            feitos.append({'conteudo': c.get('titulo'), 'id': c['id'], 'resultado': 'interrompida'})
    pedidos = [c for c in gravados if estado_andamento(c) == 'fila'
               and not any((v or {}).get('video') for v in (c.get('arquivos') or {}).values())]
    if not pedidos:
        return feitos
    with trava_edicao(base / '_rotina', agora=relogio) as pegou:
        if not pegou:
            return feitos                     # a rotina esta editando: o pedido continua na fila
        est = estado if estado is not None else rm.Estado(base / '_rotina' / 'estado.json')
        for c in pedidos:
            r = editar_fn(c, config, painel, est, relogio=relogio, log=log, **dep)
            feitos.append({'conteudo': c.get('titulo'), 'id': c['id'], 'resultado': r[0], 'detalhe': r[1]})
    return feitos
