let projects = [
  {
    name: "MerelyBot",
    url: "https://api.github.com/repos/MerelyServices/Merely-Framework/git/trees/beta",
    langurl: null,
    prefix: "",
    base: "en",
    langs: {}
  },
  {
    name: "ConfessionBot",
    url: "https://api.github.com/repos/yiays/ConfessionBot-2.0/git/trees/beta",
    langurl: null,
    prefix: "confessionbot_",
    base: "en",
    langs: {}
  }
];
let currentproject = parseInt(window.localStorage.getItem('currentproject') || '-1');
let currentlang = window.localStorage.getItem('currentlang') || '';
let changes = JSON.parse(window.localStorage.getItem('changes') || '{}');
let langcache = JSON.parse(window.localStorage.getItem('langcache') || '{}');
let offline = false;
let downloadFile = null;
const readonlykeys = [
  'meta/inherit',
  'meta/language'
]

let textdecoder;
if('TextDecoder' in window) {
  textdecoder = new TextDecoder('utf-8');
} else {
  alert("This browser isn't supported!");
}

// Local Cache System
if (!'localStorage' in window) {
  window.onbeforeunload = (e) => {
    if(Object.keys(changes).length) {
      e.preventDefault();
      return '';
    }
  }
}

// Service Worker Registration
if (navigator.serviceWorker) {
  navigator.serviceWorker
  .register('/service-worker.js', {scope: '/'})
  .catch(console.error)
} else {
  console.log('Service Worker is not supported in this browser.');
}

$().ready(() => {
  if(!getCookie('block-welcome')) {
    $('#welcome').parent().removeClass('hidden');
    $('#welcome a')[0].focus();
  }
  $('#block-welcome').on('change', (e) => {
    if(e.target.checked)
      setCookie('block-welcome', 1, 365);
    else
      setCookie('block-welcome', null, -1);
  });

  if(navigator.offline) {
    offline_mode(true);
  };

  $('body').on('click', '.menubar .menubar-item', (e) => {
    if(e.target.getAttribute('href') == '#') e.preventDefault();
    if(e.target.dataset.action == 'none') return;

    document.activeElement.blur();

    switch (e.target.dataset.action) {
      case 'save-file':
        if(currentproject >= 0 && currentlang) {
          commit_changes(true);

          const project = projects[currentproject];

          let data = json_to_ini(project.langs[currentlang]);
          let filename = `${project.name.toLowerCase()}_${currentlang}.ini`;
          save_text_as_file(data, filename);
        }
        break;
      case 'select-project':
        if(projects[e.target.dataset.id].langurl == null && !offline) return;

        if(Object.keys(changes).length && !confirm("You will lose changes to your translation. Continue?")) return;
        changes = {};
        window.localStorage.setItem('changes', '{}');
        currentproject = e.target.dataset.id;
        window.localStorage.setItem('currentproject', currentproject);
        on_project_set();
        break;

      case 'select-language':
        if(Object.keys(changes).length && !confirm("You will lose changes to your translation. Continue?")) return;
        changes = {};
        window.localStorage.setItem('changes', '{}');
        currentlang = e.target.dataset.id;
        window.localStorage.setItem('currentlang', currentlang);
        on_language_set()
        break;

      case 'new-language':
        if(Object.keys(changes).length && !confirm("You will lose changes to your translation. Continue?")) return;

        if(currentproject >= 0)
          $('#newlang').parent().removeClass('hidden');
          $('#newlang input[name="name"]').focus();
        break;

      case 'toggle-section':
        $(e.target).parent().toggleClass('closed');
        break;

      case 'select-string':
        $('.editor .section .menubar-item.selected').removeClass('selected');
        e.target.classList.add('selected');
        e.target.parentElement.parentElement.querySelector('.menubar-item').classList.add('selected');

        const project = projects[currentproject];
        const language = project.langs[currentlang];
        const baselang = project.langs[project.base];
        let inheritlang;
        if(language['meta']['inherit'] && language['meta']['inherit'].startsWith(project.prefix)) {
          inheritlang = project.langs[language['meta']['inherit'].substring(project.prefix.length)] ?? null;
        }
        let kv = e.target.dataset.id.split('/');
        $('#breadcrumb>span:gt(1)').remove();
        $('#breadcrumb').append(`<span>${kv[0]}</span>`);
        $('#breadcrumb').append(`<span>${kv[1]}</span>`);

        let keystate = resolve_key_state(baselang, null, kv[0], kv[1]);
        $('#basestring').val(keystate.state == 'valid'?keystate.value:'');

        keystate = resolve_key_state(language, inheritlang, kv[0], kv[1]);
        $('#transstring').val(['valid', 'inherited', 'changed'].includes(keystate.state)?keystate.value:'');
        $('#transstring').attr('data-id', e.target.dataset.id);

        if(readonlykeys.includes(e.target.dataset.id)) $('#transstring').prop('disabled', true);
        else $('#transstring').prop('disabled', false);

        break;
      
      case 'show-welcome':
        $('#welcome').parent().removeClass('hidden');
        $('#welcome a')[0].focus();
        $('#block-welcome').prop('checked', getCookie('block-welcome')?'true':'false');
        break;

      default:
        console.warn(`No handler defined for menubar action event ${e.target.dataset.action}`);
        break;
    }
  });

  $('body').on('click', 'button[data-action], .stealth-button', (e) => {
    switch(e.target.dataset.action) {
      case 'work-offline':
        offline_mode(true);
        break;
      
      case 'work-online':
        offline_mode(false);
        break;
      
      default:
        console.warn(`No handler defined for button action event ${e.target.dataset.action}`);
        break;
    }
  })

  $('body').on('click', '.modal-cancel', (e) => {
    if(e.target.classList.contains('modal-bg') || e.target.classList.contains('modal-cancel')) {
      e.preventDefault();

      if(e.target.classList.contains('modal-bg')) {
        e.target.classList.add('hidden');
        $(e.target).children('form').trigger('reset');
        return;
      }
      
      $(e.target).parents('.modal-bg').addClass('hidden');
      $(e.target).parents('form').trigger('reset');
      return;
    }
  });

  $('#newlang').on('submit', (e) => {
    e.preventDefault();

    let data = new FormData(e.target);
    currentlang = data.get('lang').toLowerCase();
    if(data.get('country')) {
      currentlang += '-' + data.get('country').toUpperCase();
    }

    if(Object.keys(projects[currentproject].langs).includes(currentlang)) {
      alert("This language already exists!");
      return;
    }

    changes = {
      'meta/name': data.get('name'),
      'meta/language': currentlang,
      'meta/inherit': currentlang.indexOf('-') >= 0?data.get('lang'):'',
      'meta/contributors': ''
    }
    commit_changes(true);
    update_languagelist();
    update_sectionlist();
    
    window.localStorage.setItem('currentlang', currentlang);
    window.localStorage.setItem('changes', JSON.stringify(changes));

    $('#newlang .modal-cancel').trigger('click');
  });

  // Setup while fetching projects
  update_projectlist();
  update_editor();

  // Autosave after every key press
  $('#transstring').on('input', (e) => {
    if(e.target.dataset.id) {
      const project = projects[currentproject];
      const language = project.langs[currentlang];
      let inheritlang;
      if(language['meta']['inherit'] && language['meta']['inherit'].startsWith(project.prefix)) {
        inheritlang = project.langs[language['meta']['inherit'].substring(project.prefix.length)] ?? null;
      }
      let kv = e.target.dataset.id.split('/');
      let keystate = resolve_key_state(language, inheritlang, kv[0], kv[1]);
      let ind = $(`.menubar-item[data-id="${e.target.dataset.id}"]`);

      if(
        !keystate.original
        || (keystate.original.state == 'valid' && keystate.original.value != e.target.value)
        || (['invalid','unknown'].includes(keystate.original.state) && e.target.value)) {
        changes[e.target.dataset.id] = e.target.value;
        ind.removeClass('key-state-valid key-state-invalid key-state-inherited key-state-unknown');
        ind.addClass('key-state-changed');
        if(e.target.value)
          ind.find('span.preview').text(e.target.value.substring(0, 50));
        else
          ind.find('span.preview').html('<i>blank</i>');
      }else{
        delete changes[e.target.dataset.id];
        ind.removeClass('key-state-changed');
        ind.addClass('key-state-'+keystate.original.state);
        if(e.target.value)
          ind.find('span.preview').text(e.target.value.substring(0, 50));
        else
          ind.find('span.preview').html('<i>blank</i>');
      }
      window.localStorage.setItem('changes', JSON.stringify(changes));
    }
  });

  if(currentlang == '') update_sectionlist();
});

function on_project_set() {
  console.log(`Project ${projects[currentproject].name} selected.`)
  $('.projstate').text(projects[currentproject].name);
  $('.languagelist').parent().removeClass('disabled');
  $('.langstate').text('None selected');
  $('#breadcrumb').empty();
  $('#breadcrumb').append(`<span>${projects[currentproject].name}</span>`);
  $('nav .menubar-item[data-action="save-file"]').addClass('disabled');
  $('nav .menubar-item[data-action="new-language"]').removeClass('disabled');
  document.title = projects[currentproject].name + ' | Babel Translator';
  update_languagelist();
  update_editor();
}

function update_projectlist() {
  $('.projstate').text("None selected");
  $('.projectlist').html('');
  $('.langstate').text("N/A");
  $('.languagelist').html('');

  let promises = [];
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];

    $('.projectlist').append(`
      <a href="#" class="menubar-item disabled" data-action="select-project" data-id=${i}>
        ${project.name}
      </a>
    `);
    if(offline) {
      if(project.name in langcache) {
        var projectentry = $(`.projectlist .menubar-item[data-id="${i}"]`);
        projectentry.removeClass('disabled');
      }
    }else{
      promises.push(
        $.get(project.url, (treedata) => {
          let babeltree = treedata.tree.find(tree => tree.path == 'babel');
          projects[i].langurl = babeltree.url;
          var projectentry = $(`.projectlist .menubar-item[data-id="${i}"]`);
          projectentry.removeClass('disabled');
        })
      );
    }
  }

  if(promises.length) {
    Promise.all(promises).then((_) => {
      if(currentproject >= 0) {
        on_project_set();
      }
    }).catch((error) => {
      if(error.status == 403) {
        $('#github-timeout').parent().removeClass('hidden');
      }else{
        offline_mode(true);
      }
    });
  }else{
    if(currentproject >= 0) {
      on_project_set();
    }
  }
}

function on_language_set() {
  $('.langstate').text(currentlang);
  $('#breadcrumb>span:gt(0)').remove();
  $('#breadcrumb').append(`<span>${projects[currentproject].langs[currentlang]['meta']['name']}</span>`);
  $('nav .menubar-item[data-action="save-file"]').removeClass('disabled');
  update_sectionlist();
  update_editor();

  if(currentlang == projects[currentproject].base) {
    $('label[for="basestring"],#basestring').hide();
    $('label[for="transstring"]').text("Value");
  }
  else {
    $('label[for="basestring"],#basestring').show();
    $('label[for="transstring"]').text("Translation");
  }
}
function update_languagelist() {
  $('.languagelist').html('');
  if(currentproject < 0) {
    $('.languagelist').parent().addClass('disabled');
    $('.langstate').text("N/A");
    return
  }else{
    $('.langstate').text('None selected');
  }
  
  const project = projects[currentproject];

  if(offline) {
    Object.keys(langcache[project.name]).forEach(filepath => {
      projects[currentproject].langs[filepath.slice(project.prefix.length, -4)] = langcache[project.name][filepath].data;
    });
  }
  
  if(Object.keys(project.langs).length == 0 && !offline) {
    $('.langstate').text('Loading...');
    $.get(project.langurl, (babeldata) => {
      let babelfiles = babeldata.tree;
      let promises = [];
      babelfiles.forEach(babelfile => {
        if(babelfile.path.startsWith(project.prefix) && babelfile.type == 'blob') {
          if(project.name in langcache && babelfile.path in langcache[project.name] && babelfile.sha == langcache[project.name][babelfile.path].sha) {
            projects[currentproject].langs[babelfile.path.slice(project.prefix.length, -4)] = langcache[project.name][babelfile.path].data;
            return;
          }
          promises.push($.get(babelfile.url, (data) => {
            const rawdata = textdecoder.decode(Uint8Array.from(atob(data.content), c => c.charCodeAt(0)));
            const parseddata = parseINIString(rawdata);
            if(!(project.name in langcache)) langcache[project.name] = {};
            langcache[project.name][babelfile.path] = {
              sha: babelfile.sha,
              data: parseddata
            }
            //console.log(parseddata);
            projects[currentproject].langs[babelfile.path.slice(project.prefix.length, -4)] = parseddata;
          }));
        }
      });

      if(promises.length) {
        Promise.all(promises).then((_) => {
          if(Object.keys(projects[currentproject].langs).length == 0) {
            $('.langstate').text('Load failed!');
            return;
          }
          window.localStorage.setItem('langcache', JSON.stringify(langcache));
          update_languagelist();
        }).catch((error) => {
          if(error.status == 403) {
            $('#github-timeout').parent().removeClass('hidden');
          }else{
            offline_mode(true);
          }
        });
      }else{
        update_languagelist();
      }
    });
    return;
  } else {
    if(Object.keys(project.langs).includes(currentlang)) {
      // Restore current language in editor
      on_language_set();
    } else if(currentlang && Object(changes).length) {
      // Regenerate new language that hasn't been submitted yet
      commit_changes(true);
      update_languagelist();
      update_sectionlist();
    } else {
      // Load project without a language selected
      currentlang = '';
      update_sectionlist();
    }
  }

  // Populate language list
  for(const [langname, lang] of Object.entries(projects[currentproject].langs)) {
    const progress = calculate_progress(project, langname);
    if('offline' in lang['meta']) {
      $('.languagelist').append(`
        <a href="#" class="menubar-item disabled" data-action="none">
          ${lang['meta']['name']}
          <br><i>Unavailable offline</i>
        </a>
      `);
    }else{
      $('.languagelist').append(`
        <a href="#" class="menubar-item" data-action="select-language" data-id="${langname}">
          ${lang['meta']['name']}
          <br><progress value=${progress} max=100>${progress}%</progress>
        </a>
      `);
    }
  };
  $('.languagelist').append(`
    <a href="#" class="menubar-item" data-action="new-language">
      <i>Create new</i>
    </a>
  `);
}

function update_sectionlist() {
  $('.editor .section').html('');
  if(currentlang == '') {
    $('.editor .section').append(`<p><i>Select a language</i></p>`);
    return
  }
  const project = projects[currentproject];
  const language = project.langs[currentlang];
  const baselang = project.langs[project.base];
  let inheritlang;
  if(language['meta']['inherit'] && language['meta']['inherit'].startsWith(project.prefix)) {
    inheritlang = project.langs[language['meta']['inherit'].substring(project.prefix.length)] ?? null;
  }

  Object.keys(baselang).forEach(section => {
    let out = `
      <div class="parent collapsible-parent closed">
        <a href="#" class="menubar-item" data-action="toggle-section">
          ${section}
        </a>
        <div class="collapsible">`;
    Object.keys(baselang[section]).forEach(key => {
      let keystate = resolve_key_state(language, inheritlang, section, key);
      let notes = '';
      if(keystate.state == 'inherited') notes += `Inherited from ${inheritlang['meta']['name']}. `;
      if(keystate.state == 'unknown') notes += `This key has been left blank, this may be intentional. `;

      out += `
          <a
            href="#"
            title="${notes}"
            class="menubar-item key-state-${keystate.state}"
            data-action="select-string"
            data-id="${section+'/'+key}">
            ${key}
            <br><span class="dim preview">${keystate.value.substring(0, 50)}</span>
          </a>`;
    });
    out += `
        </div>
      </div>`;
    $('.editor .section').append(out);
  });
}

function update_editor() {
  if(currentproject < 0) {
    $('#basestring').val("Welcome to Babel Translator!");
    $('#transstring').val("Select a project to get started.");
  }
  else if(currentlang == '') {
    $('#basestring').val("Welcome to Babel Translator!");
    $('#transstring').val("Select a language to begin translation.");
  }else{
    $('#basestring').val("Welcome to Babel Translator!");
    $('#transstring').val("Select a string to translate it.");
  }
  $('#transstring').prop('disabled', 'true')
}

function calculate_progress(project, lang) {
  if(lang == project.base) {
    return 100;
  }

  let refcount = 0;
  let fieldcount = 0;
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

class KeyState {
  state;
  value;
  original;

  constructor(state=null, value=null, original=null) {
    this.state = state;
    this.value = value;
    this.original = original;
  }
}
function resolve_key_state(language, inheritlang, section, key) {
  let keystate = new KeyState();
  if(section in language && key in language[section]) {
    if(language[section][key].length) {
      keystate.state = 'valid';
      keystate.value = language[section][key];
    }
    else {
      keystate.state = 'unknown';
      keystate.value = '<i>blank</i>';
    }
  }
  else {
    if(inheritlang && inheritlang != language) {
      keystate = resolve_key_state(inheritlang, null, section, key);
      if(keystate.state != 'invalid') {
        keystate.state = 'inherited';
      }
    }
    keystate.state = 'invalid';
    keystate.value = '<i>unset</i>';
  }
  if(language == projects[currentproject].langs[currentlang] && `${section}/${key}` in changes) {
    change = changes[`${section}/${key}`];
    if(change == '') change = '<i>blank</i>';
    if(change == keystate.value) {
      delete changes[`${section}/${key}`];
      return keystate;
    }
    return new KeyState('changed', change, keystate);
  } else {
    return keystate;
  }
}

function commit_changes(keep_changes=true) {
  const project = projects[currentproject];
  if(currentlang && !Object.keys(project.langs).includes(currentlang)) {
    project.langs[currentlang] = {};
  }
  let baselang = project.langs[project.base]
  let language = project.langs[currentlang];
  let exportlang = {};

  // Export keys in the same order as baselang
  Object.keys(baselang).forEach((basesection) => {
    exportlang[basesection] = {};
    Object.keys(baselang[basesection]).forEach((basekey) => {
      if(`${basesection}/${basekey}` in changes) {
        exportlang[basesection][basekey] = changes[`${basesection}/${basekey}`];
      }
      else if(basesection in language && basekey in language[basesection]) {
        exportlang[basesection][basekey] = language[basesection][basekey];
      }
    });
  })

  project.langs[currentlang] = exportlang;

  if(!keep_changes) {
    changes = {};
    window.localStorage.setItem('changes', '{}');
    update_sectionlist();
  }
}

function offline_mode(value) {
  offline = value;
  if(offline) {
    $('.offline-alert').show();
  }else{
    $('.offline-alert').hide();
  }
  update_projectlist();
}

/*
  INI Parser  - https://gist.github.com/anonymous/dad852cde5df545ed81f1bc334ea6f72
  Modified for my needs with support for multi-line values and preserving comment data
*/
function parseINIString(data){
  let regex = {
    section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
    param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
    comment: /^\s*;.*$/
  };
  let out = {};
  let lines = data.split(/[\r\n]+/);
  let section = null;
  let key = null;
  let commentcounter = 0;

  lines.forEach(function(line){
    if(regex.comment.test(line)){
      if(section) out[section]['_comment_'+commentcounter] = line;
      else out['_comment_'+commentcounter] = line;
      commentcounter++;
    }else if(regex.param.test(line)){
      let match = line.match(regex.param);
      key = match[1];
      if(section){
        out[section][key] = match[2];
      }else{
        out[key] = match[2];
      }
    }else if(key && line.startsWith('\t')){
      if(section) out[section][key] += '\n' + line.replace('\t', '');
      else out[key] += '\n' + line.replace('\t', '');
    }else if(regex.section.test(line)){
      let match = line.match(regex.section);
      out[match[1]] = {};
      section = match[1];
      key = null;
    }else if(line.length == 0 && section){
      section = null;
      key = null;
    };
  });
  return out;
}

/*
  Basic JSON to INI Converter
  Includes comment support with the _comment_i syntax.
*/
function json_to_ini(data) {
  let out = '';
  let i = 0;
  Object.entries(data).forEach((section) => {
    if(i > 0) out += '\n';
    out += `[${section[0]}]\n`;
    Object.entries(section[1]).forEach((keyvalue) => {
      if(keyvalue[0].startsWith('_comment_'))
        out += keyvalue[1] + '\n';
      else
        out += `${keyvalue[0]} = ${keyvalue[1].replaceAll('\n', '\n\t')}\n`;
    });
    i++;
  });
  return out + '\n';
}

/*
  Save text as file - https://stackoverflow.com/a/21016088/5642305
*/
function save_text_as_file(text, filename) {
  if(downloadFile !== null) window.URL.revokeObjectURL(downloadFile);

  let blob = new Blob([text], {type: 'text/plain'});
  let url = window.URL.createObjectURL(blob);
  let a = document.createElement('a');
  document.body.appendChild(a);
  a.href = url;
  a.download = filename;
  a.click();
  a.remove();
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
  let out, i, len, c;
  let char2, char3;

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
        out += String.fromCharCode(
          ((c & 0x0F) << 12) | ((char2 & 0x3F) << 6) | ((char3 & 0x3F) << 0)
        );
        break;
    }
  }
  return out;
}

/*
  Simple cookie setter/getter - https://www.w3schools.com/js/js_cookies.asp
*/

function setCookie(cname, cvalue, exdays) {
  const d = new Date();
  d.setTime(d.getTime() + (exdays*24*60*60*1000));
  let expires = "expires="+ d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}
function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(';');
  for(let i = 0; i <ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}
