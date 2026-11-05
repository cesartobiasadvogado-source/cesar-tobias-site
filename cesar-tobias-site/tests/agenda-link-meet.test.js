// Roda com: node tests/agenda-link-meet.test.js
// Agenda: o link do Meet de um compromisso continua visivel depois de salvo (na lista e ao editar).
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'painel-app.js'), 'utf8').replace(/\r\n/g, '\n');
let falhas = 0;
function t(nome, fn) { try { fn(); console.log('ok  ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + ': ' + e.message); } }

const m = /function _linkMeetSeguro\(url\) \{[^\n]*\}/.exec(fonte);
assert(m, 'funcao _linkMeetSeguro nao encontrada');
const seguro = new Function(m[0] + '\nreturn _linkMeetSeguro;')();

t('so link https vira clicavel (javascript:, http e vazio ficam de fora)', () => {
  assert.strictEqual(seguro('https://meet.google.com/abc-defg-hij'), true);
  ['javascript:alert(1)', 'http://x.com', '', null, undefined, 42].forEach(v => assert.strictEqual(seguro(v), false, String(v)));
});

t('a lista da agenda mostra o botao "Entrar no Meet" quando o compromisso tem link', () => {
  assert(fonte.includes('_linkMeetSeguro(c.link_meet)') && fonte.includes('Entrar no Meet'));
});

t('ao editar um compromisso com link, o link aparece no formulario (e some quando nao ha)', () => {
  assert(fonte.includes('_linkMeetSeguro(compromissoExistente.link_meet)'));
  assert(fonte.includes("linkMeetEl.classList.add('hidden')"));
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntudo ok');
