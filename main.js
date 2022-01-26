let projects = [
  {
    name: "MerelyBot",
    url: "https://api.github.com/repos/MerelyServices/Merely-Framework/git/trees/1.x",
    prefix: "",
    base: "en.ini",
    langs: []
  },
  {
    name: "ConfessionBot",
    url: "https://api.github.com/repos/yiays/ConfessionBot-2.0/git/trees/master",
    prefix: "confessionbot_",
    base: "confessionbot_en.ini",
    langs: []
  }
];

$().ready(() => {
  $('.menubar .menubar-item').on('click', (e) => {
    e.preventDefault();
  });

  $('.dropdown .menubar-item').on('click', (e) => {
    document.activeElement.blur();
  });

  $('.projstate').text("Loading...");
  $('.langstate').text("Loading...");
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    $.get(project.url, (treedata) => {
      let babeltree = treedata.tree.find(tree => tree.path == 'babel');
      $.get(babeltree.url, (babeldata) => {
        let babelfiles = babeldata.tree;
        babelfiles.forEach(babelfile => {
          $.get(babelfile.url, (data) => {
            projects[i].langs[babelfile.slice(0,-4)] = data;
          });
        });
      });
    });
  }
});