"""Editor local de videos do marketing (Fatia B, etapa 2).

Pega um video bruto (pasta 1-Brutos) e produz, na pasta 2-Editados:
  <nome>_editado.mp4          vertical 1080x1920, sem os silencios longos, volume normalizado,
                              com legenda queimada quando houver um arquivo .srt
  <nome>_capa_instagram.jpg   capa 1080x1920 (frame do comeco do video)
  <nome>_capa_tiktok.jpg      idem (por ora a mesma imagem; a pasta de cada rede fica separada)
  <nome>_arquivos.json        o que o painel guarda por rede: nome do video, nome da capa e uma
                              miniatura da capa (JPEG pequeno em base64) para pre-visualizar

Regras de seguranca: nunca escreve na pasta do video original, nunca sobrescreve um arquivo
existente e nao chama nenhum servico externo. So usa ffmpeg/ffprobe locais, sem shell.

Uso:  python editar_video.py VIDEO.mp4 PASTA_SAIDA [--legenda ARQ.srt] [--so-planejar]
"""
import argparse
import base64
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import edicao_video as ed

LIMIAR_DB = -35.0        # abaixo disso e silencio
SILENCIO_MIN = 0.6       # s: silencios menores que isso ficam (respiro natural da fala)
FOLGA = 0.15             # s: sobra mantida antes e depois de cada trecho falado
TRECHO_MIN = 0.25        # s: trechos falados menores que isso sao descartados (estalo, ruido)
LARGURA, ALTURA = 1080, 1920
MINIATURA_LARGURA = 270   # px: o cartao do painel mostra a capa pequena
MINIATURA_MAX_BYTES = 20000   # o painel recusa data URL acima de 30000 caracteres (~22 KB de JPEG)
REDES = ('instagram', 'tiktok')
# cobre o quadro 9:16 cortando as sobras (nunca estica) -- usado no video e na capa
QUADRO_9X16 = ('scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,setsar=1,format=yuv420p'
               % (LARGURA, ALTURA, LARGURA, ALTURA))

_PADRAO_INI = re.compile(r'silence_start:\s*(-?[\d.]+)')
_PADRAO_FIM = re.compile(r'silence_end:\s*(-?[\d.]+)')


def parse_silencedetect(texto):
    """Le a saida do filtro silencedetect e devolve [(inicio, fim)] dos silencios. Um silencio
    que comeca e nao termina (video acaba mudo) vem com fim None."""
    silencios = []
    inicio = None
    for linha in texto.splitlines():
        m = _PADRAO_INI.search(linha)
        if m:
            inicio = max(0.0, float(m.group(1)))
            continue
        m = _PADRAO_FIM.search(linha)
        if m and inicio is not None:
            silencios.append((inicio, float(m.group(1))))
            inicio = None
    if inicio is not None:
        silencios.append((inicio, None))
    return silencios


def calcular_trechos(silencios, duracao, folga=FOLGA, trecho_min=TRECHO_MIN):
    """Inverte os silencios em trechos a manter, com `folga` de cada lado. Devolve [(ini, fim)]
    em ordem, sem sobreposicao. Se nada restar, devolve o video inteiro (melhor nao cortar do
    que entregar um video vazio)."""
    if duracao <= 0:
        raise ValueError('duracao invalida')
    trechos = []
    cursor = 0.0
    for ini, fim in silencios:
        fim = duracao if fim is None else min(fim, duracao)
        if ini > cursor:
            trechos.append((cursor, ini))
        cursor = max(cursor, fim)
    if cursor < duracao:
        trechos.append((cursor, duracao))
    ampliados = []
    for ini, fim in trechos:
        ini = max(0.0, ini - folga)
        fim = min(duracao, fim + folga)
        if ampliados and ini <= ampliados[-1][1]:
            ampliados[-1] = (ampliados[-1][0], max(ampliados[-1][1], fim))
        else:
            ampliados.append((ini, fim))
    ampliados = [(i, f) for i, f in ampliados if f - i >= trecho_min]
    return ampliados or [(0.0, duracao)]


def montar_filtro(trechos, legenda=None, tem_audio=True):
    """Monta o filter_complex: corta cada trecho, junta, deixa 9:16 cobrindo o quadro (corta as
    sobras laterais, sem esticar), normaliza o volume e, se houver, queima a legenda."""
    partes = []
    for i, (ini, fim) in enumerate(trechos):
        partes.append('[0:v]trim=start=%.3f:end=%.3f,setpts=PTS-STARTPTS[v%d]' % (ini, fim, i))
        if tem_audio:
            partes.append('[0:a]atrim=start=%.3f:end=%.3f,asetpts=PTS-STARTPTS[a%d]' % (ini, fim, i))
    n = len(trechos)
    if tem_audio:
        entradas = ''.join('[v%d][a%d]' % (i, i) for i in range(n))
        partes.append('%sconcat=n=%d:v=1:a=1[vc][ac]' % (entradas, n))
        partes.append('[ac]loudnorm=I=-16:TP=-1.5:LRA=11[aout]')
    else:
        partes.append('%sconcat=n=%d:v=1:a=0[vc]' % (''.join('[v%d]' % i for i in range(n)), n))
    quadro = QUADRO_9X16
    if legenda:
        # o caminho vai dentro do filtro: troca \ por / e escapa o ':' da letra do disco
        caminho = str(legenda).replace('\\', '/').replace(':', '\\:').replace("'", "\\'")
        if str(legenda).lower().endswith('.ass'):   # a legenda ASS ja traz fonte, cor e posicao
            quadro += ",subtitles='%s'" % caminho
        else:
            quadro += ",subtitles='%s':force_style='FontSize=12,Alignment=2,MarginV=55,Outline=2'" % caminho
    partes.append('[vc]%s[vout]' % quadro)
    return ';\n'.join(partes)


def _rodar(args, **kw):
    return subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='replace', **kw)


def _rodar_com_progresso(args, total_s, avisar):
    """Roda o ffmpeg e chama avisar(fracao 0..1) conforme ele avanca (`-progress pipe:1`). Devolve o mesmo
    formato do subprocess.run (returncode, stderr). A saida de erro vai para um arquivo para nao travar o pipe."""
    with tempfile.TemporaryFile(mode='w+', encoding='utf-8', errors='replace') as erros:
        p = subprocess.Popen(args + ['-progress', 'pipe:1'], stdout=subprocess.PIPE, stderr=erros, text=True,
                             encoding='utf-8', errors='replace')
        for linha in p.stdout:
            chave, _, valor = linha.strip().partition('=')
            if chave in ('out_time_us', 'out_time_ms') and valor.lstrip('-').isdigit() and total_s > 0:
                avisar(min(max(int(valor) / 1e6 / total_s, 0.0), 1.0))
        p.wait()
        erros.seek(0)
        return subprocess.CompletedProcess(args, p.returncode, '', erros.read())


def sondar(video):
    r = _rodar(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type',
                '-of', 'json', str(video)])
    if r.returncode != 0:
        raise RuntimeError('ffprobe falhou: ' + r.stderr.strip()[:300])
    info = json.loads(r.stdout)
    duracao = float(info['format']['duration'])
    tem_audio = any(s.get('codec_type') == 'audio' for s in info.get('streams', []))
    return duracao, tem_audio


def detectar_silencios(video):
    r = _rodar(['ffmpeg', '-hide_banner', '-nostats', '-i', str(video), '-vn',
                '-af', 'silencedetect=noise=%ddB:d=%.2f' % (LIMIAR_DB, SILENCIO_MIN), '-f', 'null', '-'])
    if r.returncode != 0:
        raise RuntimeError('ffmpeg (deteccao de silencio) falhou: ' + r.stderr.strip()[-300:])
    return parse_silencedetect(r.stderr)


def gerar_miniatura(capa, pasta_tmp):
    """Reduz a capa para um JPEG de ate MINIATURA_MAX_BYTES e devolve como data URL. Tenta
    qualidades cada vez menores; se nenhuma couber, falha em vez de mandar uma imagem grande."""
    for qualidade in (8, 12, 16, 20, 25):
        destino = Path(pasta_tmp) / ('mini_q%d.jpg' % qualidade)
        r = _rodar(['ffmpeg', '-hide_banner', '-nostats', '-y', '-i', str(capa),
                    '-vf', 'scale=%d:-2' % MINIATURA_LARGURA, '-frames:v', '1',
                    '-q:v', str(qualidade), str(destino)])
        if r.returncode != 0 or not destino.exists():
            raise RuntimeError('ffmpeg (miniatura) falhou: ' + r.stderr.strip()[-300:])
        dados = destino.read_bytes()
        if len(dados) <= MINIATURA_MAX_BYTES:
            return 'data:image/jpeg;base64,' + base64.b64encode(dados).decode('ascii')
    raise RuntimeError('nao consegui deixar a miniatura abaixo de %d bytes' % MINIATURA_MAX_BYTES)


def montar_arquivos(base, miniatura):
    """O objeto `arquivos` que o painel espera (marketing.py), um por rede."""
    return {rede: {'video': base + '_editado.mp4', 'capa': '%s_capa_%s.jpg' % (base, rede),
                   'miniatura': miniatura} for rede in REDES}


def _checar_saida(video, saida):
    video = Path(video).resolve()
    saida = Path(saida).resolve()
    if saida == video.parent:
        raise ValueError('a pasta de saida nao pode ser a pasta do video original')
    saida.mkdir(parents=True, exist_ok=True)
    return saida


def planejar_cortes(video, duracao, tem_audio, opcoes, palavras):
    """Escolhe os trechos a manter. Sem `opcoes` (modo antigo): so silencios longos pelo volume. Com
    `opcoes`: `cortar_pausas` usa as lacunas entre palavras; sem palavras, cai no volume; desligado, mantem tudo."""
    if opcoes is None:
        silencios = detectar_silencios(video) if tem_audio else []
        return calcular_trechos(silencios, duracao)
    if not opcoes.get('cortar_pausas'):
        return [(0.0, duracao)]
    if palavras:
        return ed.trechos_por_palavras(palavras, duracao)
    silencios = detectar_silencios(video) if tem_audio else []
    return calcular_trechos(silencios, duracao)


def editar(video, pasta_saida, legenda=None, so_planejar=False, opcoes=None, palavras=None, nome_base=None, progresso=None,
           trechos=None):
    """`trechos`: [(ini, fim)] do original a manter, ja decididos por quem chama (ajustes pedidos); sem eles, a edicao decide.
    `nome_base`: nome dos arquivos de saida (padrao: o do video); serve para editar de novo sem sobrescrever.
    `progresso(etapa, pct)`: avisa em que ponto esta (pct de 0 a 100, so da edicao)."""
    avisar = progresso or (lambda etapa, pct: None)
    video = Path(video)
    if not video.is_file():
        raise FileNotFoundError(str(video))
    saida = _checar_saida(video, pasta_saida)
    base = nome_base or video.stem
    destino = saida / (base + '_editado.mp4')
    capas = [saida / (base + '_capa_instagram.jpg'), saida / (base + '_capa_tiktok.jpg')]
    json_arquivos = saida / (base + '_arquivos.json')
    for arq in [destino, json_arquivos] + capas:
        if arq.exists():
            raise FileExistsError('ja existe, nao sobrescrevo: ' + str(arq))
    avisar('Analisando o vídeo', 3)
    duracao, tem_audio = sondar(video)
    avisar('Planejando os cortes', 8)
    if trechos is None:
        trechos = planejar_cortes(video, duracao, tem_audio, opcoes, palavras)
    elif not trechos or any(f <= i or i < 0 or f > duracao + 0.5 for i, f in trechos):
        raise ValueError('trechos invalidos')
    mantido = sum(f - i for i, f in trechos)
    modo_legenda = (opcoes or {}).get('legenda', 'nenhuma') if opcoes is not None else None
    texto_ass = None
    if modo_legenda in ('simples', 'destaque') and palavras:
        texto_ass = ed.gerar_ass(ed.remapear_palavras(palavras, trechos), destaque=(modo_legenda == 'destaque'))
    plano = {'video': str(video), 'duracao_original': round(duracao, 2), 'duracao_final': round(mantido, 2),
             'trechos': len(trechos), 'tem_audio': tem_audio, 'legenda': bool(legenda) or texto_ass is not None,
             'modo_legenda': modo_legenda, 'saida': str(destino)}
    if so_planejar:
        return plano
    with tempfile.TemporaryDirectory() as tmp:
        if texto_ass is not None:
            arq_ass = Path(tmp) / 'legenda.ass'
            arq_ass.write_text(texto_ass, encoding='utf-8')
            legenda = arq_ass   # a legenda refeita para o video JA cortado vale mais que um .srt do video original
        filtro = montar_filtro(trechos, legenda=legenda, tem_audio=tem_audio)
        script = Path(tmp) / 'filtro.txt'
        script.write_text(filtro, encoding='utf-8')
        parcial = Path(tmp) / 'saida.mp4'
        cmd = ['ffmpeg', '-hide_banner', '-nostats', '-y', '-i', str(video),
               '-filter_complex_script', str(script), '-map', '[vout]']
        if tem_audio:
            cmd += ['-map', '[aout]', '-c:a', 'aac', '-b:a', '160k']
        cmd += ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-r', '30',
                '-movflags', '+faststart', str(parcial)]
        avisar('Cortando, legendando e ajustando o áudio', 12)
        if progresso:
            ultimo = [-1]

            def andou(fracao):
                pct = 12 + int(fracao * 73)                  # a edicao ocupa de 12% a 85%
                if pct != ultimo[0]:
                    ultimo[0] = pct
                    avisar('Cortando, legendando e ajustando o áudio', pct)
            r = _rodar_com_progresso(cmd, mantido, andou)
        else:
            r = _rodar(cmd)
        if r.returncode != 0:
            raise RuntimeError('ffmpeg (edicao) falhou: ' + r.stderr.strip()[-400:])
        avisar('Criando as capas', 90)
        # capa: um frame do video ORIGINAL (sem legenda queimada), logo depois de a fala comecar,
        # no mesmo enquadramento 9:16 do video editado
        capa_tmp = Path(tmp) / 'capa.jpg'
        instante = min(trechos[0][0] + 0.8, max(duracao - 0.1, 0.0))
        r = _rodar(['ffmpeg', '-hide_banner', '-nostats', '-y', '-ss', '%.3f' % instante, '-i', str(video),
                    '-frames:v', '1', '-vf', QUADRO_9X16, '-q:v', '2', str(capa_tmp)])
        if r.returncode != 0 or not capa_tmp.exists():
            raise RuntimeError('ffmpeg (capa) falhou: ' + r.stderr.strip()[-300:])
        shutil.move(str(parcial), str(destino))
        for capa in capas:
            capa.write_bytes(capa_tmp.read_bytes())
        avisar('Salvando os arquivos', 96)
        miniatura = gerar_miniatura(capa_tmp, tmp)
    json_arquivos.write_text(json.dumps(montar_arquivos(base, miniatura), ensure_ascii=False, indent=2),
                             encoding='utf-8')
    plano['capas'] = [str(c) for c in capas]
    plano['arquivos_json'] = str(json_arquivos)
    return plano


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('video')
    ap.add_argument('pasta_saida')
    ap.add_argument('--legenda', help='arquivo .srt para queimar no video')
    ap.add_argument('--so-planejar', action='store_true', help='so mostra o que seria cortado')
    a = ap.parse_args(argv)
    try:
        plano = editar(a.video, a.pasta_saida, legenda=a.legenda, so_planejar=a.so_planejar)
    except (FileNotFoundError, FileExistsError, ValueError, RuntimeError) as e:
        print('ERRO: ' + str(e), file=sys.stderr)
        return 1
    print(json.dumps(plano, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
