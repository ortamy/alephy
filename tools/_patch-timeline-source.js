const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcPath = path.join(root, 'products/website/apps/researchlab/data/timeline.json');
const buildPath = path.join(root, 'products/website/build/apps/researchlab/data/timeline.json');

const SOURCE_BY_TITLE = {
  'Хурбан Байит Шени': 'content/researches/systems/vatican.md',
  'Восстание Бар-Кохбы': 'content/researches/archive/religion-war-machine.md',
  'Масора Тивериады': 'content/tanakh/archive/masoretic-text.md',
  'Кодекс Алеппо': 'content/tanakh/archive/masoretic-text.md',
  'Ленинградский кодекс': 'content/tanakh/archive/masoretic-text.md',
  'Микраот Гедолот': 'docs/06-METHODOLOGY/TRANSLATION.md',
  'Библия короля Якова': 'content/researches/history/erasmus-textus-receptus.md',
  'dies Solis': 'content/teachings/catholicism.md',
  'Лаодикия, канон 29': 'content/teachings/catholicism.md',
  'Эдикт Феодосия': 'content/tanakh/archive/catholic-church.md',
  'II Никея: иконопочитание': 'content/teachings/iconoclasm.md',
  'Реформация': 'content/teachings/lutheranism.md',
  'Григорианский календарь': 'content/researches/practices/shavuot-practice.md',
  'Имперская упаковка': 'content/tanakh/archive/catholic-church.md',
  'Крещение Руси': 'content/researches/language/russian-syncretism.md',
  'Стела Меши': 'docs/04-STANDARD/TERMINOLOGY.md',
  'Силоамская надпись': 'docs/04-STANDARD/TERMINOLOGY.md',
  'Остраконы Лахиша': 'content/tanakh/archive/paleo-hebrew.md',
  'Раскопки Масады': 'content/researches/history/missing-hebrew-scrolls.md',
  'Палео-ивритское письмо': 'docs/04-STANDARD/PALEO-STANDARD.md',
  'Кумранские свитки': 'data/qumran-books.json',
  'Публикация свитков': 'data/qumran-books.json',
  'Цифровая реконструкция': 'content/tanakh/archive/digital-bavel.md',
  'Базы данных рукописей': 'data/qumran-books.json',
  'Палео-шрифты': 'tasks/GOL-001-PALEO-FONT.md',
  'Шин — зуб и давление': 'docs/07-MECHANICS/SHIN-TOOTH.md',
  'Шар — движение наружу': 'docs/07-MECHANICS/SHIN-TOOTH.md',
  'Шем — обозначение': 'docs/07-MECHANICS/SHIN-TOOTH.md',
  'Шал — движение к целому': 'docs/07-MECHANICS/SHIN-TOOTH.md',
  'Шала — посланное действие': 'docs/07-MECHANICS/SHIN-TOOTH.md',
  'Тоху': 'docs/06-METHODOLOGY/STATES.md',
  'Хошех': 'docs/06-METHODOLOGY/STATES.md',
  'Мицраим': 'docs/06-METHODOLOGY/STATES.md',
  'Шамаим': 'docs/06-METHODOLOGY/STATES.md',
  'Мидбар': 'docs/06-METHODOLOGY/STATES.md',
  'Эрец': 'docs/06-METHODOLOGY/STATES.md',
  'Эден': 'docs/06-METHODOLOGY/STATES.md',
  'Палео-поток': 'docs/04-STANDARD/PALEO-STANDARD.md',
  'Масоретский': 'content/tanakh/archive/masoretic-text.md',
  'Греческий': 'docs/06-METHODOLOGY/TRANSLATION.md',
  'Латынь': 'docs/06-METHODOLOGY/TRANSLATION.md',
  'Славянский': 'content/researches/language/slavic-distortion.md',
  'Синодальный': 'content/researches/language/russian-syncretism.md',
  'Прасемитский': 'data/paleo-linguistics/languages.json',
  'Аккадский': 'data/paleo-linguistics/akkadian.json',
  'Угаритский': 'data/paleo-linguistics/ugaritic.json',
  'Арамейский': 'data/paleo-linguistics/aramaic.json',
  'Иврит': 'data/paleo-linguistics/paleo-hebrew.json',
  'Прото-ханаанский': 'data/paleo-linguistics/proto-canaanite.json',
  'Финикийский': 'data/paleo-linguistics/phoenician.json',
  'Палео-иврит': 'data/paleo-linguistics/paleo-hebrew.json',
  'Квадратный иврит': 'content/tanakh/archive/paleo-hebrew.md'
};

const RESOLVE = {
  'content/': 'products/website/src/content/md/',
  'data/': 'products/website/apps/researchlab/data/',
  'docs/': 'docs/',
  'tasks/': 'tasks/',
  'researches/': 'researches/'
};

function diskPath(source) {
  const bare = source.replace(/\.md$/, '');
  if (source.startsWith('content/')) return path.join(root, RESOLVE['content/'], source.slice('content/'.length));
  if (source.startsWith('data/')) return path.join(root, RESOLVE['data/'], source.slice('data/'.length));
  if (source.startsWith('docs/')) return path.join(root, source);
  if (source.startsWith('tasks/')) return path.join(root, source);
  if (source.startsWith('researches/')) {
    const withMd = source.endsWith('.md') ? source : source + '.md';
    return path.join(root, withMd);
  }
  return path.join(root, source);
}

const data = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const missingAfter = [];
const filled = [];
const unknown = [];
const missingFiles = [];

data.forEach(function (timeline) {
  (timeline.events || []).forEach(function (event) {
    if (event.source) return;
    const source = SOURCE_BY_TITLE[event.title];
    if (!source) {
      unknown.push(timeline.id + ' / ' + event.title);
      return;
    }
    const file = diskPath(source);
    if (!fs.existsSync(file) && !fs.existsSync(file.replace(/\.md$/, ''))) {
      missingFiles.push(source + ' <- ' + event.title);
      return;
    }
    event.source = source;
    filled.push(event.title);
  });
});

data.forEach(function (timeline) {
  (timeline.events || []).forEach(function (event) {
    if (!event.source) missingAfter.push(timeline.id + ' / ' + event.title);
  });
});

if (unknown.length || missingFiles.length || missingAfter.length) {
  console.error('unknown', unknown);
  console.error('missingFiles', missingFiles);
  console.error('missingAfter', missingAfter);
  process.exit(1);
}

const json = JSON.stringify(data, null, 2) + '\n';
fs.writeFileSync(srcPath, json);
fs.writeFileSync(buildPath, json);
console.log('filled', filled.length);
console.log(filled.join('\n'));
