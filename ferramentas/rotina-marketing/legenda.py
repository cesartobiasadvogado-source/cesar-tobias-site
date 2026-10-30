"""Sugestao de legenda do post a partir do roteiro (a fala transcrita). Por REGRAS, sem IA paga e sem internet.

E so um rascunho para a pessoa revisar: reaproveita as proprias palavras do video (gancho + duas frases) e
acrescenta uma chamada neutra, o aviso de conteudo informativo e hashtags tiradas do assunto. Nao acrescenta
promessa, preco, comparacao nem chamada para contratar. O painel ainda avisa se algo parecer arriscado
(Provimento 205/2021 da OAB), mas quem decide e a pessoa.
"""
import re
import unicodedata
from collections import Counter

CHAMADA_PADRAO = 'Salve este vídeo para consultar depois e compartilhe com quem pode se interessar.'
AVISO_PADRAO = 'Conteúdo informativo, não substitui a consulta com um advogado.'
LIMITE_GANCHO = 140
LIMITE_FRASE = 200
LIMITE_LEGENDA = 2200

_SAUDACAO = re.compile(r'^(ol[aá]|oi|e a[ií]|bom dia|boa tarde|boa noite|fala,? (pessoal|galera)|pessoal)\b[\s,!.:;-]*', re.IGNORECASE)
# pergunta que so faz sentido dentro do video ("Ele comeca...?"): nao serve de gancho fora de contexto
_COMECA_SOLTO = re.compile(r'^(ele|ela|eles|elas|isso|esse|essa|esses|essas|este|esta|então|entao|mas|e|porque|pois|ai|aí|nesse|nessa|nisso)\b', re.IGNORECASE)
_FRASE_FINAL = re.compile(r'(?<=[.!?])\s+')
_IGNORAR_HASHTAG = frozenset(
    'para como mais mas que uma uns umas por com sem sobre entre ate seu sua seus suas ele ela eles elas isso esse essa '
    'esses essas este esta estes estas aqui ali ainda voce voces nos nao sim tem ter foi ser sao era vai vou pode podem '
    'fazer faz muito muita tudo todo toda todos todas quando onde porque pois tambem depois antes mesmo cada outro outra '
    'hoje agora entao assim ficar fica quero preciso precisa existe algum alguma algum fundo sucesso video audio '
    'gravacao teste rapido decorar falas dificeis encontrar natural claro seguro repare altura minha minhas '
    'pessoal galera falar falamos vamos sobre objetivo depende conferir atencao importante lembrando'.split())


def _sem_acento(texto):
    return unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode('ascii')


def _cortar(texto, limite):
    """Corta no limite sem partir palavra, com reticencias."""
    texto = texto.strip()
    if len(texto) <= limite:
        return texto
    corte = texto[:limite].rsplit(' ', 1)[0].rstrip(' ,;:-')
    return corte + '…'


def _frases(roteiro):
    bruto = re.sub(r'\s+', ' ', roteiro or '').strip()
    frases = []
    for f in _FRASE_FINAL.split(bruto):
        f = _SAUDACAO.sub('', f.strip(), count=1).strip()      # tira so a saudacao do comeco ("Ola,"), mantem o resto
        if len(f.split()) < 4:
            continue
        frases.append(f[0].upper() + f[1:])
    return frases


def hashtags(titulo, roteiro, maximo=4):
    palavras = re.findall(r'[a-zA-ZÀ-ÿ]{6,}', (titulo or '') + ' ' + (roteiro or ''))
    contagem = Counter()
    for p in palavras:
        base = _sem_acento(p).lower()
        if base not in _IGNORAR_HASHTAG:
            contagem[base] += 1
    # mais frequentes primeiro; empate: a que apareceu antes
    ordem = {_sem_acento(p).lower(): i for i, p in reversed(list(enumerate(palavras)))}
    escolhidas = sorted(contagem, key=lambda w: (-contagem[w], ordem[w]))[:maximo]
    return ['#' + w for w in escolhidas]


def sugerir_legenda(titulo, roteiro, chamada=CHAMADA_PADRAO, aviso=AVISO_PADRAO, maximo_hashtags=4, limite=LIMITE_LEGENDA):
    """Devolve o texto sugerido ('' se nao ha de onde tirar)."""
    frases = _frases(roteiro)
    if not frases and (titulo or '').strip():
        frases = [titulo.strip()]
    if not frases:
        return ''
    # gancho: uma pergunta entre as primeiras frases, senao a primeira
    gancho = next((f for f in frases[:5] if f.endswith('?') and not _COMECA_SOLTO.match(f)), frases[0])
    corpo = [f for f in frases if f != gancho][:2]
    partes = [_cortar(gancho, LIMITE_GANCHO)]
    if corpo:
        partes.append('\n'.join(_cortar(f, LIMITE_FRASE) for f in corpo))
    if chamada:
        partes.append(chamada)
    if aviso:
        partes.append(aviso)
    tags = hashtags(titulo, roteiro, maximo_hashtags)
    if tags:
        partes.append(' '.join(tags))
    texto = '\n\n'.join(partes)
    while len(texto) > limite and len(partes) > 3:   # mantem gancho, chamada/aviso; tira primeiro as hashtags e o corpo
        partes.pop(-1 if tags and partes[-1].startswith('#') else 1)
        tags = [] if partes and not partes[-1].startswith('#') else tags
        texto = '\n\n'.join(partes)
    return texto[:limite].rstrip()
