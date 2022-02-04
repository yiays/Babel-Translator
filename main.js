let projects = [
  {
    name: "MerelyBot",
    url: "https://api.github.com/repos/MerelyServices/Merely-Framework/git/trees/1.x",
    langurl: null,
    prefix: "",
    base: "en",
    langs: {}
  },
  {
    name: "ConfessionBot",
    url: "https://api.github.com/repos/yiays/ConfessionBot-2.0/git/trees/master",
    langurl: null,
    prefix: "confessionbot_",
    base: "en",
    langs: {}
  }
];
let currentproject = -1;
let currentlang = '';

let textdecoder;
if('TextDecoder' in window) {
  textdecoder = new TextDecoder('utf-8');
} else {
  alert("This browser isn't supported!");
}

$().ready(() => {
  $('body').on('click', '.menubar .menubar-item', (e) => {
    if(e.target.getAttribute('href') == '#') e.preventDefault();
    if(e.target.dataset.action == 'none') return;

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
        update_sectionlist();
        break;
      case 'toggle-section':
        $(e.target).parent().toggleClass('closed');
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
      projects[i].langurl = babeltree.url;
    });
  }
});

function update_languagelist() {
  $('.languagelist').html('');
  if(currentproject < 0) {
    $('.languagelist').parent().addClass('disabled');
    $('.langstate').text("N/A");
    return
  }
  const project = projects[currentproject];
  currentlang = -1;

  if(Object.keys(project.langs).length == 0) {
    $('.langstate').text('Loading...');
    $.get(project.langurl, (babeldata) => {
      let babelfiles = babeldata.tree;
      let promises = [];
      babelfiles.forEach(babelfile => {
        if(babelfile.path.startsWith(project.prefix) && babelfile.type == 'blob') {
          promises.push($.get(babelfile.url, (data) => {
            const rawdata = textdecoder.decode(Uint8Array.from(atob(data.content), c => c.charCodeAt(0)));
            const parseddata = parseINIString(rawdata);
            console.log(parseddata);
            projects[currentproject].langs[babelfile.path.slice(project.prefix.length, -4)] = parseddata;
          }));
        }
      });

      Promise.all(promises).then((_) => {
        if(Object.keys(projects[currentproject].langs).length == 0) {
          $('.langstate').text('Load failed!');
          return;
        }
        update_languagelist();
      })
    });
    return;
  }

  $('.languagelist').parent().removeClass('disabled');
  $('.langstate').text('None selected');

  for(const [langname, lang] of Object.entries(projects[currentproject].langs)) {
    const progress = calculate_progress(project, langname);
    $('.languagelist').append(`
      <a href="#" class="menubar-item" data-action="select-language" data-id="${langname}">
        ${lang['meta']['name']}
        <br><progress value=${progress} max=100>${progress}%</progress>
      </a>
    `);
  };
}

function calculate_progress(project, lang) {
  if(lang == project.base) {
    return 100;
  }

  var refcount = 0;
  var fieldcount = 0;
  Object.keys(project.langs[project.base]).forEach(section => {
    if(section in project.langs[lang]) {
      Object.keys(project.langs[project.base][section]).forEach(key => {
        refcount++;
        if(key in project.langs[lang][section]) fieldcount++;
      });
    }else{
      refcount += Object.keys(project.langs[project.base]).length;
    }
  });
  return (fieldcount/refcount)*100; // TODO: Add support for inheritance
}

function update_sectionlist() {
  $('.editor .section').html('');
  if(currentlang < 0) {
    $('.editor .section').append(`<i>Select a language</i>`);
    return
  }
  const project = projects[currentproject];
  const language = project.langs[currentlang];

  Object.keys(language).forEach(section => {
    let out = `
      <div class="parent collapsible-parent closed">
        <a href="#" class="menubar-item" data-action="toggle-section">
          ${section}
        </a>
        <div class="collapsible">`;
    Object.keys(language[section]).forEach(key => {
      out += `
          <a href="#" class="menubar-item" data-action="select-string" data-id="${section+'/'+key}}">
            ${key}
            <br><span class="dim preview">${language[section][key].substring(0, 50)}</span>
          </a>`;
    });
    out += `
        </div>
      </div>`;
    $('.editor .section').append(out);
  });
}

/*
  INI Parser  - https://gist.github.com/anonymous/dad852cde5df545ed81f1bc334ea6f72
*/
function parseINIString(data){
  var regex = {
      section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
      param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
      comment: /^\s*;.*$/
  };
  var value = {};
  var lines = data.split(/[\r\n]+/);
  var section = null;
  lines.forEach(function(line){
      if(regex.comment.test(line)){
          return;
      }else if(regex.param.test(line)){
          var match = line.match(regex.param);
          if(section){
              value[section][match[1]] = match[2];
          }else{
              value[match[1]] = match[2];
          }
      }else if(regex.section.test(line)){
          var match = line.match(regex.section);
          value[match[1]] = {};
          section = match[1];
      }else if(line.length == 0 && section){
          section = null;
      };
  });
  return value;
}

// http://www.onicos.com/staff/iz/amuse/javascript/expert/utf.txt

/* utf.js - UTF-8 <=> UTF-16 convertion
 *
 * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
 * Version: 1.0
 * LastModified: Dec 25 1999
 * This library is free.  You can redistribute it and/or modify it.
 */

function Utf8ArrayToStr(array) {
  var out, i, len, c;
  var char2, char3;

  out = "";
  len = array.length;
  i = 0;
  while(i < len) {
  c = array[i++];
  switch(c >> 4)
  { 
    case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
      // 0xxxxxxx
      out += String.fromCharCode(c);
      break;
    case 12: case 13:
      // 110x xxxx   10xx xxxx
      char2 = array[i++];
      out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
      break;
    case 14:
      // 1110 xxxx  10xx xxxx  10xx xxxx
      char2 = array[i++];
      char3 = array[i++];
      out += String.fromCharCode(((c & 0x0F) << 12) |
                     ((char2 & 0x3F) << 6) |
                     ((char3 & 0x3F) << 0));
      break;
  }
  }

  return out;
}