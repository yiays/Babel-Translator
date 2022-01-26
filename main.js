let projects = [
  {
    name: "MerelyBot",
    url: "https://api.github.com/repos/MerelyServices/Merely-Framework/git/trees/1.x",
    prefix: "",
    base: "en.ini",
    langs: {}
  },
  {
    name: "ConfessionBot",
    url: "https://api.github.com/repos/yiays/ConfessionBot-2.0/git/trees/master",
    prefix: "confessionbot_",
    base: "confessionbot_en.ini",
    langs: {}
  }
];
let currentproject = -1;
let currentlang = '';

$().ready(() => {
  $('body').on('click', '.menubar .menubar-item', (e) => {
    if(e.target.getAttribute('href') == '#') e.preventDefault();
  });

  $('body').on('click', '.dropdown .menubar-item', (e) => {
    document.activeElement.blur();

    switch (e.target.dataset.action) {
      case 'select-project':
        currentproject = e.target.dataset.id;
        console.log(`Project ${projects[currentproject].name} selected.`)
        $('.projstate').text(projects[currentproject].name);
        document.title = projects[currentproject].name + ' | Babel Translator';
        update_languagelist();
        break;
      case 'select-language':
        currentlang = e.target.dataset.id;
        $('.langstate').text(currentlang);
        break;
      default:
        console.warn(`No handler defined for action event ${e.target.dataset.action}`);
        break;
    }
  });

  $('.projstate').text("None selected");
  $('.projectlist').html('');
  $('.langstate').text("N/A");
  $('.languagelist').html('');
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];

    $('.projectlist').append(`
    <a href="#" class="menubar-item" data-action="select-project" data-id=${i}>
      ${project.name}
    </a>`);

    $.get(project.url, (treedata) => {
      let babeltree = treedata.tree.find(tree => tree.path == 'babel');
      $.get(babeltree.url, (babeldata) => {
        let babelfiles = babeldata.tree;
        babelfiles.forEach(babelfile => {
          if(babelfile.path.startsWith(project.prefix) && babelfile.type == 'blob') {
            $.get(babelfile.url, (data) => {
              projects[i].langs[babelfile.path.slice(project.prefix.length, -4)] = data;
            });
          }
        });
      });
    });
  }
});

function update_languagelist() {
  $('.languagelist').html('');
  if(currentproject < 0) {
    $('.languagelist').parent().addClass('disabled');
    $('.langstate').text("N/A");
  }else{
    currentlang = -1;
    $('.languagelist').parent().removeClass('disabled');
    $('.langstate').text('None selected');

    for(const [langname, lang] of Object.entries(projects[currentproject].langs)) {
      $('.languagelist').append(`
        <a href="#" class="menubar-item" data-action="select-language" data-id="${langname}">
          ${langname}
        </a>
      `);
    };
  }
}