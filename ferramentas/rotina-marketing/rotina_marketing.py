"""Rotina do marketing (Fatia B, etapa 3): roda 2x por dia pelo Agendador de Tarefas do Windows.

Para cada video novo em 1-Brutos:
  1. transcreve a fala (Whisper local, gratis, no proprio computador);
  2. descobre de qual conteudo do painel o video e (pelo nome do arquivo, ou comparando a fala com o
     titulo/roteiro) e ESCREVE o roteiro sozinha com a transcricao, se ele estiver vazio. Se o video nao
     e de nenhum conteudo, cria um conteudo novo ja com o roteiro;
  3. so EDITA depois que a pessoa confirmar, no cartao do conteudo, como quer aquele video
     (cortar pausas, tipo de legenda...). Antes disso apenas avisa no cartao "video encontrado";
  4. edita (editar_video.py) para 2-Editados e grava no painel os arquivos por rede e uma SUGESTAO de
     dia/hora. Nao agenda e nao posta nada: quem aprova o agendamento e a pessoa, no painel.

Seguranca: nunca altera nem apaga o video original; nunca sobrescreve arquivo editado; a senha do
usuario da rotina fica no cofre do Windows (keyring), nunca em arquivo; o usuario da rotina so
precisa da permissao "Conteudo (marketing)".

Uso:  python rotina_marketing.py [--config config.json] [--so-listar]
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
from datetime import date, datetime, timedelta
from pathlib import Path

import edicao_video as ed
import editar_video as ev

EXTENSOES = ('.mp4', '.mov', '.m4v', '.mkv', '.webm')
IDADE_MINIMA_S = 180          # arquivo mexido ha menos que isso ainda esta sendo gravado/sincronizado
MIN_PONTUACAO = 0.45          # fracao das palavras do roteiro que apareceram na fala
MARGEM_SEGUNDO = 0.15         # vantagem minima sobre o 2o colocado para decidir sozinho
MIN_TITULO = 0.40             # idem, quando o conteudo so tem titulo (sem roteiro escrito)
MIN_ACERTOS = 2               # palavras-chave em comum, no minimo (uma so e coincidencia)
DUVIDA = 0.25                 # entre isto e o minimo, nao decide nem cria conteudo novo: avisa no relatorio
TENTATIVAS_MAX = 3
STOPWORDS = frozenset(
    'para como mais mas que uma uns umas por com sem sobre entre ate seu sua seus suas ele ela eles '
    'elas isso esse essa esses essas este esta estes estas aqui ali ainda voce voces nos nao sim '
    'tem ter foi ser sao era vai vou pode podem fazer faz muito muita tudo todo toda todos todas '
    'quando onde porque pois ja so tambem depois antes mesmo cada outro outra'.split())


# ---------------------------------------------------------------------------------------------
# Texto e correspondencia video <-> roteiro
# ---------------------------------------------------------------------------------------------

def normalizar(texto):
    """minusculas, sem acento, so letras/numeros."""
    texto = unicodedata.normalize('NFKD', texto or '').encode('ascii', 'ignore').decode('ascii').lower()
    return re.sub(r'[^a-z0-9 ]+', ' ', texto)


def palavras_chave(texto):
    return {p for p in normalizar(texto).split() if len(p) >= 4 and p not in STOPWORDS}


def pontuar(fala, titulo, roteiro):
    """Fracao das palavras-chave do conteudo (titulo + roteiro) que aparecem na fala."""
    alvo = palavras_chave((titulo or '') + ' ' + (roteiro or ''))
    if len(alvo) < 2:
        return 0.0
    return len(alvo & palavras_chave(fala)) / len(alvo)


def acertos(fala, titulo, roteiro):
    """Quantas palavras-chave do conteudo aparecem na fala."""
    return len(palavras_chave((titulo or '') + ' ' + (roteiro or '')) & palavras_chave(fala))


def _compacto(texto):
    return normalizar(texto).replace(' ', '')


def escolher_correspondencia(fala, candidatos, nome_video=None):
    """Devolve (candidato ou None, ranking). 1o) o nome do arquivo aparece no titulo (ex.: titulo "IMG_2713");
    2o) as palavras da fala batem com titulo+roteiro, com folga clara sobre o segundo colocado e ao menos
    MIN_ACERTOS palavras em comum. Conteudo sem roteiro escrito (so titulo) exige MIN_TITULO em vez de
    MIN_PONTUACAO. Na duvida, None."""
    chave = _compacto(nome_video or '')
    if len(chave) >= 4:
        for c in candidatos:
            if chave in _compacto(c.get('titulo')):
                return c, [(1.0, c)]
    ranking = sorted(((pontuar(fala, c.get('titulo'), c.get('roteiro')), c) for c in candidatos),
                     key=lambda x: -x[0])
    if not ranking:
        return None, ranking
    topo, melhor = ranking[0]
    minimo = MIN_PONTUACAO if (melhor.get('roteiro') or '').strip() else MIN_TITULO
    if topo < minimo or acertos(fala, melhor.get('titulo'), melhor.get('roteiro')) < MIN_ACERTOS:
        return None, ranking
    if len(ranking) > 1 and topo - ranking[1][0] < MARGEM_SEGUNDO:
        return None, ranking
    return melhor, ranking


def titulo_sugerido(fala, nome_video):
    """Titulo para um conteudo criado a partir de um video sem ideia previa: as primeiras palavras da fala."""
    palavras = (fala or '').replace('\n', ' ').split()
    if len(palavras) < 3:
        return 'Video ' + Path(nome_video).stem
    texto = ' '.join(palavras[:8]).rstrip(',;:')
    return (texto + '...') if len(palavras) > 8 else texto


def texto_do_srt(srt):
    linhas = []
    for linha in (srt or '').splitlines():
        linha = linha.strip()
        if not linha or linha.isdigit() or '-->' in linha:
            continue
        linhas.append(linha)
    return ' '.join(linhas)


# ---------------------------------------------------------------------------------------------
# Sugestao de dia/hora
# ---------------------------------------------------------------------------------------------

def proxima_sugestao(ocupados, hoje, horarios=('18:30',), dias_semana=(0, 1, 2, 3, 4, 5, 6), limite_dias=60):
    """Primeiro (data ISO, 'HH:MM') livre a partir de AMANHA. `ocupados` e um conjunto de
    (data ISO, 'HH:MM') ja agendados ou ja sugeridos. dias_semana: 0=segunda ... 6=domingo."""
    for n in range(1, limite_dias + 1):
        dia = hoje + timedelta(days=n)
        if dia.weekday() not in dias_semana:
            continue
        for hora in horarios:
            if (dia.isoformat(), hora) not in ocupados:
                return dia.isoformat(), hora
    return None, None


def horarios_ocupados(conteudos):
    ocupados = set()
    for c in conteudos:
        if c.get('status') == 'agendado' and c.get('data_postagem') and c.get('hora_postagem'):
            ocupados.add((str(c['data_postagem'])[:10], str(c['hora_postagem'])[:5]))
        if c.get('sugestao_data') and c.get('sugestao_hora'):
            ocupados.add((str(c['sugestao_data'])[:10], str(c['sugestao_hora'])[:5]))
    return ocupados


# ---------------------------------------------------------------------------------------------
# Arquivos e estado
# ---------------------------------------------------------------------------------------------

def chave_arquivo(caminho, stat=None):
    st = stat or Path(caminho).stat()
    return '%s|%d|%d' % (Path(caminho).name, st.st_size, int(st.st_mtime))


def listar_novos(pasta_brutos, estado, agora=None, idade_min=IDADE_MINIMA_S):
    """Videos de 1-Brutos que ainda nao foram concluidos e ja pararam de ser gravados/sincronizados."""
    agora = agora if agora is not None else time.time()
    achados = []
    for arq in sorted(Path(pasta_brutos).iterdir()):
        if not arq.is_file() or arq.suffix.lower() not in EXTENSOES or arq.name.startswith(('.', '~')):
            continue
        st = arq.stat()
        if agora - st.st_mtime < idade_min or st.st_size == 0:
            continue
        chave = chave_arquivo(arq, st)
        item = estado.get(chave) or {}
        if item.get('status') == 'concluido' or item.get('tentativas', 0) >= TENTATIVAS_MAX:
            continue
        achados.append((arq, chave))
    return achados


def juntar_arquivos(existentes, novos, redes_do_conteudo):
    """Atualiza video/capa/miniatura das redes do conteudo SEM apagar links que a pessoa ja colou."""
    alvo = [r for r in novos if r in (redes_do_conteudo or [])] or list(novos)
    resultado = {r: dict(v) for r, v in (existentes or {}).items()}
    for rede in alvo:
        atual = resultado.get(rede, {})
        atual.update({k: v for k, v in novos[rede].items() if v})
        resultado[rede] = atual
    return resultado


class Estado:
    def __init__(self, caminho):
        self.caminho = Path(caminho)
        try:
            self.dados = json.loads(self.caminho.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            self.dados = {}

    def get(self, chave):
        return self.dados.get(chave)

    def marcar(self, chave, **campos):
        self.dados.setdefault(chave, {}).update(campos)
        self.salvar()

    def salvar(self):
        self.caminho.parent.mkdir(parents=True, exist_ok=True)
        parcial = self.caminho.with_suffix('.tmp')
        parcial.write_text(json.dumps(self.dados, ensure_ascii=False, indent=1), encoding='utf-8')
        os.replace(parcial, self.caminho)


# ---------------------------------------------------------------------------------------------
# Painel (login + conteudos)
# ---------------------------------------------------------------------------------------------

class Painel:
    """Fala com o painel pelo mesmo proxy do site. `http` e o modulo requests (ou um falso nos testes)."""

    def __init__(self, url_base, usuario, senha, http, tempo_limite=30):
        self.base = url_base.rstrip('/') + '/api/painel'
        self.http = http
        self.tempo_limite = tempo_limite
        self._usuario, self._senha = usuario, senha
        self.token = None

    def _json(self, resposta):
        try:
            dados = resposta.json()
        except ValueError:
            dados = {}
        if resposta.status_code >= 400:
            raise RuntimeError('painel respondeu %d: %s' % (resposta.status_code, str(dados.get('erro', ''))[:200]))
        return dados

    def entrar(self):
        r = self.http.post(self.base + '?acao=login', json={'usuario': self._usuario, 'senha': self._senha},
                           timeout=self.tempo_limite)
        dados = self._json(r)
        self.token = dados.get('token')
        if not self.token:
            raise RuntimeError('login do painel nao devolveu token')
        self._senha = None  # nao guarda a senha em memoria depois de entrar

    def _cab(self):
        return {'Authorization': 'Bearer ' + self.token}

    def listar(self, status):
        r = self.http.get(self.base, params={'acao': 'conteudo_listar', 'status': status},
                          headers=self._cab(), timeout=self.tempo_limite)
        return self._json(r).get('conteudos', [])

    def atualizar(self, conteudo_id, campos):
        corpo = dict(campos, id=conteudo_id)
        r = self.http.post(self.base + '?acao=conteudo_atualizar', json=corpo, headers=self._cab(),
                           timeout=self.tempo_limite)
        return self._json(r)

    def criar(self, campos):
        """Cria um conteudo e devolve o id."""
        r = self.http.post(self.base + '?acao=conteudo_criar', json=campos, headers=self._cab(),
                           timeout=self.tempo_limite)
        return self._json(r)['id']


# ---------------------------------------------------------------------------------------------
# Transcricao (Whisper local)
# ---------------------------------------------------------------------------------------------

def transcrever_whisper(video, pasta_saida, modelo='small', idioma='pt'):
    """Roda o Whisper instalado no computador e devolve (texto, caminho do .srt). Ao lado do .srt fica o
    .json com o tempo de CADA palavra (e dele que saem os cortes e a legenda com destaque)."""
    pasta_saida = Path(pasta_saida)
    pasta_saida.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(['whisper', str(video), '--model', modelo, '--language', idioma, '--word_timestamps', 'True',
                        '--output_format', 'all', '--output_dir', str(pasta_saida), '--verbose', 'False'],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    srt = pasta_saida / (Path(video).stem + '.srt')
    if r.returncode != 0 or not srt.exists() or not srt.with_suffix('.json').exists():
        raise RuntimeError('whisper falhou: ' + (r.stderr or r.stdout).strip()[-300:])
    return texto_do_srt(srt.read_text(encoding='utf-8')), srt


def opcoes_de_edicao(edicao):
    """As escolhas que a pessoa confirmou no cartao, no formato que o editor entende."""
    edicao = edicao or {}
    legenda = edicao.get('legenda')
    return {'cortar_pausas': bool(edicao.get('cortar_pausas', True)),
            'legenda': legenda if legenda in ('nenhuma', 'simples', 'destaque') else 'destaque'}


# ---------------------------------------------------------------------------------------------
# Orquestracao
# ---------------------------------------------------------------------------------------------

class Dependencias:
    """Tudo que toca o mundo fora fica aqui, para os testes trocarem por falsos."""

    def __init__(self, painel, transcrever=transcrever_whisper, editar=ev.editar, agora=time.time, hoje=date.today):
        self.painel, self.transcrever, self.editar, self.agora, self.hoje = painel, transcrever, editar, agora, hoje


def executar(config, deps, so_listar=False, log=print):
    base = Path(config['pasta_base'])
    brutos, editados = base / '1-Brutos', base / '2-Editados'
    estado = Estado(base / '_rotina' / 'estado.json')
    relatorio = {'processados': [], 'aguardando_escolha': [], 'criados': [], 'sem_correspondencia': [], 'erros': [], 'aguardando': []}

    novos = listar_novos(brutos, estado.dados, agora=deps.agora())
    log('%d video(s) novo(s) em 1-Brutos' % len(novos))
    if so_listar or not novos:
        relatorio['aguardando'] = [a.name for a, _ in novos]
        return relatorio

    deps.painel.entrar()
    gravados = deps.painel.listar('gravado')
    # o video tambem pode ser de uma ideia/roteiro que a pessoa esqueceu de marcar como gravado
    candidatos = gravados + deps.painel.listar('para_gravar') + deps.painel.listar('ideia')
    todos = gravados + deps.painel.listar('agendado')
    ocupados = horarios_ocupados(todos)
    log('%d conteudo(s) possivel(is) no painel (gravados, para gravar e ideias)' % len(candidatos))

    for video, chave in novos:
        item = estado.get(chave) or {}
        try:
            if 'fala' in item and Path(item.get('srt', '')).exists() and Path(item['srt']).with_suffix('.json').exists():
                fala, srt = item['fala'], Path(item['srt'])
            else:
                fala, srt = deps.transcrever(video, base / '_rotina' / 'transcricoes')
                estado.marcar(chave, fala=fala, srt=str(srt), arquivo=video.name)
            escolhido, ranking = escolher_correspondencia(fala, candidatos, nome_video=video.stem)
            if not escolhido:
                melhor = ranking[0][0] if ranking else 0.0
                if melhor >= DUVIDA:
                    # parecido demais para criar outro, diferente demais para decidir: a pessoa resolve
                    log('  %s: parece com "%s" (%.2f) mas sem certeza; nada foi criado' % (video.name, ranking[0][1].get('titulo'), melhor))
                    relatorio['sem_correspondencia'].append(video.name)
                    continue
                # video sem ideia previa: cria o conteudo ja com o roteiro (a fala) esperando a escolha de edicao
                novo = {'titulo': titulo_sugerido(fala, video.name), 'roteiro': fala, 'formato': 'fala_camera',
                        'redes': ['instagram', 'tiktok'], 'status': 'gravado',
                        'data_gravar': deps.hoje().isoformat(), 'edicao': {'video_encontrado': video.name},
                        'observacao': 'Criado automaticamente a partir do video ' + video.name + '.'}
                novo['id'] = deps.painel.criar(novo)
                escolhido = dict(novo, arquivos={})
                estado.marcar(chave, status='aguardando_escolha', conteudo_id=novo['id'])
                relatorio['criados'].append({'video': video.name, 'conteudo': novo['titulo']})
                log('  %s: sem ideia correspondente; criei o conteudo "%s"' % (video.name, novo['titulo']))
            else:
                ajustes = {}
                if escolhido.get('status') != 'gravado':
                    ajustes['status'] = 'gravado'          # o video chegou: equivale a apertar "Gravei"
                if not (escolhido.get('roteiro') or '').strip():
                    ajustes['roteiro'] = fala              # nunca apaga um roteiro que a pessoa escreveu
                if ajustes:
                    deps.painel.atualizar(escolhido['id'], ajustes)
                    escolhido = dict(escolhido, **ajustes)
            edicao = escolhido.get('edicao') or {}
            if not edicao.get('confirmado'):
                # ainda nao escolheu como editar: so avisa no cartao (uma vez) e espera
                if edicao.get('video_encontrado') != video.name:
                    deps.painel.atualizar(escolhido['id'], {'edicao': dict(edicao, video_encontrado=video.name)})
                estado.marcar(chave, status='aguardando_escolha', conteudo_id=escolhido['id'])
                relatorio['aguardando_escolha'].append({'video': video.name, 'conteudo': escolhido['titulo']})
                log('  %s -> "%s": aguardando voce escolher a edicao no painel' % (video.name, escolhido['titulo']))
                continue
            palavras = ed.ler_palavras(srt.with_suffix('.json'))
            plano = deps.editar(video, editados, opcoes=opcoes_de_edicao(edicao), palavras=palavras)
            dados_arq = json.loads(Path(plano['arquivos_json']).read_text(encoding='utf-8'))
            data_s, hora_s = proxima_sugestao(
                ocupados, deps.hoje(), tuple(config.get('horarios', ['18:30'])),
                tuple(config.get('dias_semana', [0, 1, 2, 3, 4, 5, 6])))
            campos = {'arquivos': juntar_arquivos(escolhido.get('arquivos'), dados_arq, escolhido.get('redes'))}
            if data_s:
                campos.update(sugestao_data=data_s, sugestao_hora=hora_s)
                ocupados.add((data_s, hora_s))
            deps.painel.atualizar(escolhido['id'], campos)
            candidatos = [c for c in candidatos if c['id'] != escolhido['id']]
            estado.marcar(chave, status='concluido', conteudo_id=escolhido['id'],
                          concluido_em=datetime.now().isoformat(timespec='seconds'))
            relatorio['processados'].append({'video': video.name, 'conteudo': escolhido['titulo'],
                                             'sugestao': [data_s, hora_s]})
            log('  %s -> "%s" (sugestao %s %s)' % (video.name, escolhido['titulo'], data_s, hora_s))
        except Exception as e:  # um video com problema nao pode travar os outros
            tentativas = item.get('tentativas', 0) + 1
            estado.marcar(chave, tentativas=tentativas, ultimo_erro=str(e)[:300])
            relatorio['erros'].append({'video': video.name, 'erro': str(e)[:300], 'tentativa': tentativas})
            log('  %s: ERRO (%d/%d): %s' % (video.name, tentativas, TENTATIVAS_MAX, e))
    return relatorio


def gravar_relatorio(config, relatorio):
    pasta = Path(config['pasta_base']) / '_rotina'
    pasta.mkdir(parents=True, exist_ok=True)
    arq = pasta / ('relatorio-%s.json' % datetime.now().strftime('%Y-%m-%d'))
    historico = []
    if arq.exists():
        try:
            historico = json.loads(arq.read_text(encoding='utf-8'))
        except ValueError:
            historico = []
    historico.append({'quando': datetime.now().isoformat(timespec='seconds'), **relatorio})
    arq.write_text(json.dumps(historico, ensure_ascii=False, indent=1), encoding='utf-8')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--config', default=str(Path(__file__).with_name('config.json')))
    ap.add_argument('--so-listar', action='store_true', help='so mostra os videos novos, sem transcrever nem mexer em nada')
    a = ap.parse_args(argv)
    config = json.loads(Path(a.config).read_text(encoding='utf-8'))
    trava = Path(config['pasta_base']) / '_rotina' / 'rodando.lock'
    trava.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(str(trava), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        # trava velha (queda de energia) nao pode bloquear para sempre: 3 h
        if time.time() - trava.stat().st_mtime < 3 * 3600:
            print('ja existe uma execucao em andamento; saindo')
            return 0
        trava.unlink()
        fd = os.open(str(trava), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    os.close(fd)
    try:
        import keyring
        import requests
        senha = keyring.get_password('vero-rotina-marketing', config['usuario'])
        if not senha and not a.so_listar:
            print('ERRO: senha da rotina nao cadastrada. Rode configurar_senha.py')
            return 1
        painel = Painel(config['url_painel'], config['usuario'], senha, requests)
        relatorio = executar(config, Dependencias(painel), so_listar=a.so_listar)
        if not a.so_listar:
            gravar_relatorio(config, relatorio)
        print(json.dumps(relatorio, ensure_ascii=False, indent=1))
        return 1 if relatorio['erros'] else 0
    finally:
        try:
            trava.unlink()
        except OSError:
            pass


if __name__ == '__main__':
    sys.exit(main())
