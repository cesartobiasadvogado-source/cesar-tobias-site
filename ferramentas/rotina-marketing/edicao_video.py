"""Logica pura da edicao (sem ffmpeg, sem rede): decide cortes a partir das palavras que o Whisper
marcou, refaz o tempo das palavras depois dos cortes e monta a legenda com a palavra falada em destaque.

Por que pelas palavras: o corte por volume (silencedetect) depende do barulho do ambiente e nao achou
nenhuma pausa num video real (fala a -26 dB, quarto a -30 dB). A lacuna entre duas palavras e um
sinal confiavel de pausa, e cortar so DENTRO da lacuna garante que nenhuma palavra marcada seja cortada.
"""
import json
from pathlib import Path

PAUSA_MINIMA = 0.40     # s: lacuna entre palavras a partir da qual ha corte
FOLGA = 0.12            # s: sobra mantida de cada lado da lacuna (a pausa que resta e ~2 x FOLGA)
ENTRADA = 0.25          # s: antes da primeira palavra
SAIDA = 0.40            # s: depois da ultima palavra
TRECHO_MIN = 0.20

# legenda (ASS). Tamanhos em pixels do quadro 1080x1920.
LARGURA, ALTURA = 1080, 1920
MAX_PALAVRAS_LINHA = 4
MAX_CARACTERES_LINHA = 26
PAUSA_QUEBRA_LINHA = 0.60
COR_BASE = '&H00FFFFFF'        # branco (ASS usa BGR)
COR_DESTAQUE = '&H0000E5FF'    # amarelo-ouro


def ler_palavras(caminho_json):
    """Palavras [(inicio, fim, texto)] do JSON do Whisper (--word_timestamps True)."""
    dados = json.loads(Path(caminho_json).read_text(encoding='utf-8'))
    palavras = []
    for seg in dados.get('segments', []):
        for w in seg.get('words', []):
            texto = (w.get('word') or '').strip()
            if texto and w.get('end', 0) >= w.get('start', 0):
                palavras.append((float(w['start']), float(w['end']), texto))
    palavras.sort(key=lambda p: p[0])
    return palavras


def trechos_por_palavras(palavras, duracao, pausa_minima=PAUSA_MINIMA, folga=FOLGA,
                         entrada=ENTRADA, saida=SAIDA, trecho_min=TRECHO_MIN):
    """Trechos [(ini, fim)] do video original a MANTER. Corta o silencio do comeco, do fim e as lacunas
    entre palavras maiores que `pausa_minima`, deixando `folga` de cada lado. Sem palavras, devolve o
    video inteiro (melhor nao cortar do que entregar um video vazio)."""
    if duracao <= 0:
        raise ValueError('duracao invalida')
    if not palavras:
        return [(0.0, duracao)]
    inicio = max(0.0, palavras[0][0] - entrada)
    fim = min(duracao, palavras[-1][1] + saida)
    trechos = []
    atual = inicio
    for (_, fim_a, _), (ini_b, _, _) in zip(palavras, palavras[1:]):
        if ini_b - fim_a >= pausa_minima:
            trechos.append((atual, min(duracao, fim_a + folga)))
            atual = max(0.0, ini_b - folga)
    trechos.append((atual, fim))
    trechos = [(i, f) for i, f in trechos if f - i >= trecho_min]
    return trechos or [(0.0, duracao)]


def duracao_final(trechos):
    return sum(f - i for i, f in trechos)


def remapear_palavras(palavras, trechos):
    """Reposiciona cada palavra na linha do tempo do video JA CORTADO. Palavra fora dos trechos some;
    palavra que atravessa a borda de um trecho e recortada."""
    resultado = []
    deslocamento = 0.0
    for ini, fim in trechos:
        for p_ini, p_fim, texto in palavras:
            if p_fim <= ini or p_ini >= fim:
                continue
            novo_ini = max(p_ini, ini) - ini + deslocamento
            novo_fim = min(p_fim, fim) - ini + deslocamento
            resultado.append((novo_ini, max(novo_fim, novo_ini + 0.02), texto))
        deslocamento += fim - ini
    resultado.sort(key=lambda p: p[0])
    return resultado


def agrupar_linhas(palavras, max_palavras=MAX_PALAVRAS_LINHA, max_caracteres=MAX_CARACTERES_LINHA,
                   pausa_quebra=PAUSA_QUEBRA_LINHA):
    """Divide as palavras em linhas curtas, que cabem na tela de celular. Quebra em pontuacao final,
    em pausa longa, ou ao estourar o limite de palavras/caracteres."""
    linhas, atual = [], []
    for i, palavra in enumerate(palavras):
        if atual:
            tamanho = len(' '.join(p[2] for p in atual)) + 1 + len(palavra[2])
            pausa = palavra[0] - atual[-1][1]
            if len(atual) >= max_palavras or tamanho > max_caracteres or pausa >= pausa_quebra:
                linhas.append(atual)
                atual = []
        atual.append(palavra)
        if palavra[2][-1:] in '.?!' and len(palavra[2]) > 1:
            linhas.append(atual)
            atual = []
    if atual:
        linhas.append(atual)
    return linhas


def _tempo_ass(segundos):
    cs = int(round(max(segundos, 0) * 100))
    return '%d:%02d:%02d.%02d' % (cs // 360000, (cs // 6000) % 60, (cs // 100) % 60, cs % 100)


def _limpar(texto):
    # chaves e barra invertida tem significado especial em ASS
    return texto.replace('\\', '').replace('{', '').replace('}', '')


CABECALHO_ASS = """[Script Info]
ScriptType: v4.00+
PlayResX: {largura}
PlayResY: {altura}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Fala,Arial,{tamanho},{base},{base},&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,6,2,2,60,60,{margem_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def gerar_ass(palavras, destaque=True, tamanho=76, margem_v=430, segura_final=0.25):
    """Legenda em ASS. Com `destaque`, a palavra falada no momento fica colorida (um evento por palavra,
    mostrando a linha inteira); sem, mostra cada linha inteira branca do inicio ao fim da fala dela.
    `palavras` ja deve estar na linha do tempo do video editado (ver remapear_palavras)."""
    saida = [CABECALHO_ASS.format(largura=LARGURA, altura=ALTURA, tamanho=tamanho, base=COR_BASE, margem_v=margem_v)]
    linhas = agrupar_linhas(palavras)
    for n, linha in enumerate(linhas):
        textos = [_limpar(p[2]) for p in linha]
        # a linha segura `segura_final` na tela, mas nunca invade o comeco da proxima (duas linhas
        # juntas se sobrepoem e ficam ilegiveis)
        limite = linhas[n + 1][0][0] if n + 1 < len(linhas) else None
        ultimo_fim = linha[-1][1] + segura_final
        if limite is not None:
            ultimo_fim = min(ultimo_fim, limite)
        if not destaque:
            ini, fim = linha[0][0], max(ultimo_fim, linha[0][0] + 0.05)
            saida.append('Dialogue: 0,%s,%s,Fala,,0,0,0,,%s\n' % (_tempo_ass(ini), _tempo_ass(fim), ' '.join(textos)))
            continue
        for i, palavra in enumerate(linha):
            ini = palavra[0]
            if i + 1 < len(linha):
                fim = linha[i + 1][0]          # a palavra seguinte assume exatamente onde esta termina
            else:
                fim = max(ultimo_fim, ini + 0.05)
            partes = []
            for j, t in enumerate(textos):
                partes.append('{\\c%s}%s{\\c%s}' % (COR_DESTAQUE, t, COR_BASE) if j == i else t)
            saida.append('Dialogue: 0,%s,%s,Fala,,0,0,0,,%s\n' % (_tempo_ass(ini), _tempo_ass(fim), ' '.join(partes)))
    return ''.join(saida)
