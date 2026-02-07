var helpData = null;
var loadedLang = null;
var currentHelpSection = 'players';

function loadHelp(sectionKey) {
  currentHelpSection = sectionKey;

  var lang = localStorage.getItem("appLanguage") || "en";

  // Update active button
  document.querySelectorAll('.help-btn')
    .forEach(btn => btn.classList.remove('active'));

  var activeBtn = document.querySelector(
    `.help-btn[onclick="loadHelp('${sectionKey}')"]`
  );
  if (activeBtn) activeBtn.classList.add('active');

  // Reload help JSON if language changed
  if (!helpData || loadedLang !== lang) {
    fetch(`https://samkarikalan.github.io/APP/help_${lang}.json?v=${Date.now()}`)
      .then(res => {
        if (!res.ok) throw new Error("Help file not found");
        return res.json();
      })
      .then(data => {
        helpData = data;
        loadedLang = lang;
        showHelpSection(sectionKey);
      })
      .catch(() => {
        document.getElementById('helpContainer').innerHTML =
          '<p style="color:red;">Help file not available for this language.</p>';
      });
  } else {
    showHelpSection(sectionKey);
  }
}

function showHelpSection(sectionKey) {
  var container = document.getElementById('helpContainer');
  var sectionObj = helpData?.[sectionKey];

  if (!sectionObj) {
    container.innerHTML = '<p>No help found for this section.</p>';
    return;
  }

  var html = '';

  for (var topicKey in sectionObj) {
    var topic = sectionObj[topicKey];
    html += `
      <div class="help-card">
        ${topic.title ? `<h3>${topic.title}</h3>` : ''}
        ${topic.content ? `<p>${topic.content}</p>` : ''}
        ${topic.list
          ? `<ul>${topic.list.map(item => `<li>${item}</li>`).join('')}</ul>`
          : ''}
      </div>
    `;
  }

  container.innerHTML = html;
}

/* ===============================
   LANGUAGE CHANGE HANDLER
   =============================== */
function changeLanguage(lang) {
  localStorage.setItem("appLanguage", lang);

  // 🔥 Instantly refresh help in current section
  loadHelp(currentHelpSection);
}

// Initial load
loadHelp(currentHelpSection);
