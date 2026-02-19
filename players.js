const textarea = document.getElementById("player-name");
const defaultHeight = 40;

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

textarea.addEventListener("input", function () {
  autoResize(this);
});

textarea.addEventListener("blur", function () {
  if (!this.value.trim()) {
    this.style.height = defaultHeight + "px";
  }
});



function getGenderIconByName(playerName) {
  const player = schedulerState.allPlayers.find(
    p => p.name === playerName
  );

  if (!player) return "❔";

  return player.gender === "Male" ? "👨‍💼" : "🙎‍♀️";
}

function refreshFixedCards() {
  const list = document.getElementById("fixed-pair-list");
  list.innerHTML = "";

  schedulerState.fixedPairs.forEach(([p1, p2], index) => {
    addFixedCard(p1, p2, index);
  });
}


function updateFixedPairSelectors() {
  const sel1 = document.getElementById('fixed-pair-1');
  const sel2 = document.getElementById('fixed-pair-2');
  const pairedPlayers = new Set(schedulerState.fixedPairs.flat());

  sel1.innerHTML = '<option value="" data-i18n="selectPlayer1"></option>';
  sel2.innerHTML = '<option value="" data-i18n="selectPlayer2"></option>';

  schedulerState.activeplayers.slice().reverse().forEach(p => {
    if (!pairedPlayers.has(p)) {
      const option1 = document.createElement('option');
      const option2 = document.createElement('option');

      const icon = getGenderIconByName(p);

      option1.value = option2.value = p;
      option1.textContent = option2.textContent = `${icon} ${p}`;

      sel1.appendChild(option1);
      sel2.appendChild(option2);
    }
  });
}

function addFixedCard(p1, p2, key) {
  const list = document.getElementById('fixed-pair-list');

  const card = document.createElement("div");
  card.className = "fixed-card";
  card.setAttribute("data-key", key);

  const icon1 = getGenderIconByName(p1);
  const icon2 = getGenderIconByName(p2);

  card.innerHTML = `
    <div class="fixed-name">
      ${icon1} ${p1} & ${icon2} ${p2}
    </div>
    <div class="fixed-delete">
      <button class="pec-btn delete"
              onclick="modifyFixedPair('${p1}', '${p2}')">🗑</button>
    </div>
  `;

  list.appendChild(card);
}



function pastePlayersText() {
  const textarea = document.getElementById('players-textarea');

  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText()
      .then(text => {
        textarea.value += (textarea.value ? '\n' : '') + text;
        textarea.focus();
      })
      .catch(() => {
        alert('Paste not allowed. Long-press and paste instead.');
      });
  } else {
    alert('Paste not supported on this device.');
  }
}



function showImportModal() {
  const textarea = document.getElementById("players-textarea");
  // Clear any entered text
  textarea.value = "";
  textarea.placeholder = translations[currentLang].importExample;
  document.getElementById('importModal').style.display = 'block';
}

function hideImportModal() {
  document.getElementById('newImportModal').style.display = 'none';
  //document.getElementById('players-textarea').value = '';
}

/* =========================
   ADD SINGLE PLAYER
========================= */
function addPlayer() {

  const textarea = document.getElementById("player-name");
  if (!textarea) return;

  const text = textarea.value.trim();
  if (!text) return;

  const defaultGender =
    document.getElementById("player-gender")?.value || "Male";

  const lines = text.split(/\r?\n/);

  // ======================
  // GENDER LOOKUP (multi-language)
  // ======================
  const genderLookup = {};

  if (typeof translations !== "undefined") {
    Object.values(translations).forEach(langObj => {
      if (langObj.male)
        genderLookup[langObj.male.toLowerCase()] = "Male";

      if (langObj.female)
        genderLookup[langObj.female.toLowerCase()] = "Female";
    });
  }

  // fallback English
  genderLookup["male"] = "Male";
  genderLookup["m"] = "Male";
  genderLookup["female"] = "Female";
  genderLookup["f"] = "Female";

  const extractedNames = [];

  for (let line of lines) {

    line = line.trim();
    if (!line) continue;

    let gender = defaultGender;

    // Remove numbering (1. John → John)
    const match = line.match(/^(\d+\.?\s*)?(.*)$/);
    if (match) line = match[2].trim();

    // ======================
    // name, gender
    // ======================
    if (line.includes(",")) {
      const parts = line.split(",").map(p => p.trim());
      line = parts[0];

      if (parts[1]) {
        const g = parts[1].toLowerCase();
        if (genderLookup[g]) gender = genderLookup[g];
      }
    }

    // ======================
    // name (gender)
    // ======================
    const parenMatch = line.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const inside = parenMatch[1].trim().toLowerCase();

      if (genderLookup[inside])
        gender = genderLookup[inside];

      line = line.replace(/\([^)]+\)/, "").trim();
    }

    if (!line) continue;

    const normalized = line.toLowerCase();

    // Avoid duplicates
    const exists =
      schedulerState.allPlayers.some(
        p => p.name.trim().toLowerCase() === normalized
      ) ||
      extractedNames.some(
        p => p.name.trim().toLowerCase() === normalized
      );

    if (!exists) {
      extractedNames.push({
        name: line,
        gender,
        active: true
      });
    }
  }

  if (extractedNames.length === 0) return;

  // ======================
  // SAVE
  // ======================
  schedulerState.allPlayers.push(...extractedNames);

  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

  updatePlayerList();
  updateFixedPairSelectors();

  // ======================
  // RESET UI (smooth shrink)
  // ======================
  const defaultHeight = 40;
  textarea.value = "";
  textarea.style.height = defaultHeight + "px";
  textarea.focus();
}


function oldaddPlayer() {
  const name = document.getElementById('player-name').value.trim();
  const gender = document.getElementById('player-gender').value;
  if (name && !schedulerState.allPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    schedulerState.allPlayers.push({ name, gender, active: true });
    schedulerState.activeplayers = schedulerState.allPlayers
      .filter(p => p.active)
      .map(p => p.name)
      .reverse();

    updatePlayerList();
    updateFixedPairSelectors();
  } else if (name) {
    alert(`Player "${name}" already exists!`);
  }
  document.getElementById('player-name').value = '';
  	
}


/* =========================
   EDIT PLAYER INFO
========================= */
function editPlayer(i, field, val) {
  const player = schedulerState.allPlayers[i];

  // Normal update
  if (field === 'active') {
    player.active = !!val;                         // make sure it's boolean
    if (val) {                                     // ←←← THIS IS THE ONLY NEW PART
      const highest = Math.max(0, ...schedulerState.allPlayers.map(p => p.turnOrder || 0));
      player.turnOrder = highest + 1;              // put him at the very end of the line
    }
  } else {
    player[field] = val.trim();
  }

  // Your two existing lines — unchanged
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

  updatePlayerList();
  updateFixedPairSelectors();  	
}

function removeFixedPairsForPlayer(playerName) {
  // Remove from data
  schedulerState.fixedPairs = schedulerState.fixedPairs.filter(pair => {
    const keep = !pair.includes(playerName);
    if (!keep) {
      const key = pair.slice().sort().join("&");
      removeFixedCard(key); // Remove UI card
    }
    return keep;
  });

  updateFixedPairSelectors();
}

/* =========================
   DELETE PLAYER
========================= */
function deletePlayer(i) {
  const deletedPlayer = schedulerState.allPlayers[i]?.name;
  if (!deletedPlayer) return;

  // 1️⃣ Remove player
  schedulerState.allPlayers.splice(i, 1);

  // 2️⃣ Remove any fixed pairs involving this player
  removeFixedPairsForPlayer(deletedPlayer);

  // 3️⃣ Recalculate active players
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

  // 4️⃣ Refresh UI
  updatePlayerList();
  updateFixedPairSelectors();
  refreshFixedCards(); // 🔥 THIS is the key
}



function olddeletePlayer(i) {
  schedulerState.allPlayers.splice(i, 1);
   schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

  updatePlayerList();
  updateFixedPairSelectors();
  
}

function toggleActive(index, checkbox) {
  // Update data model first
  schedulerState.allPlayers[index].active = checkbox.checked;

  const card = checkbox.closest(".player-edit-card");

  // Apply the CSS class based on active state
  if (checkbox.checked) {
    card.classList.remove("inactive");
  } else {
    card.classList.add("inactive");
  }

  // Recalculate active players list
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
	.reverse();

  // Refresh UI
  updateFixedPairSelectors();
  
	
}


function getGenderIcon(gender) {
  return gender === "Male" ? "👨‍💼" : "🙎‍♀️";
}

function toggleGender(index, iconEl) {
  const player = schedulerState.allPlayers[index];
  if (!player) return;

  // 1️⃣ Toggle gender
  player.gender = player.gender === "Male" ? "Female" : "Male";

  const genderClass = player.gender.toLowerCase();

  // 2️⃣ Update icon
  iconEl.textContent = getGenderIcon(player.gender);

  // 3️⃣ Update icon class
  iconEl.classList.remove("male", "female");
  iconEl.classList.add(genderClass);

  // 4️⃣ Update card class
  const card = iconEl.closest(".player-edit-card");
  if (card) {
    card.classList.remove("male", "female");
    card.classList.add(genderClass);
  }

  // 5️⃣ Update linked state
  updateGenderGroups();

  // 6️⃣ Refresh dependent UI
  updateFixedPairSelectors();
  refreshFixedCards(); // 🔥 THIS fixes your issue
}


function updateGenderGroups() {
  schedulerState.malePlayers = schedulerState.allPlayers
    .filter(p => p.gender === "Male" && p.active)
    .map(p => p.name);

  schedulerState.femalePlayers = schedulerState.allPlayers
    .filter(p => p.gender === "Female" && p.active)
    .map(p => p.name);
}

function addPlayersFromInputUI() {

  const importPlayers = newImportState.enterPlayers;

  if (!importPlayers || importPlayers.length === 0) {
    alert('No players to add!');
    return;
  }

  const extractedNames = [];

  importPlayers.forEach(p => {

    const name = p.displayName.trim();
    const gender = p.gender || "Male";

    if (
      !schedulerState.allPlayers.some(
        existing => existing.name.trim().toLowerCase() === name.toLowerCase()
      ) &&
      !extractedNames.some(
        existing => existing.name.trim().toLowerCase() === name.toLowerCase()
      )
    ) {
      extractedNames.push({
        name: name,
        gender: gender,
        active: true
      });
    }

  });

  schedulerState.allPlayers.push(...extractedNames);

  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

  updatePlayerList();
  updateFixedPairSelectors();
  hideImportModal();

  // Optional: reset selection after import
  newImportState.selectPlayers = [];
}


/* =========================
   ADD PLAYERS FROM TEXT
========================= */
function addPlayersFromText() {

  const textarea = document.getElementById("players-textarea");
  if (!textarea) return;

  const text = textarea.value.trim();
  if (!text) return;

  const defaultGender =
    document.querySelector('input[name="genderSelect"]:checked')?.value || "Male";

  const lines = text.split(/\r?\n/);

  // stop markers
  const stopMarkers = [
    /court full/i, /wl/i, /waitlist/i, /late cancel/i,
    /cancelled/i, /reserve/i, /bench/i, /extras/i, /backup/i
  ];

  let startIndex = 0;
  let stopIndex = lines.length;

  // detect "confirm" section
  const confirmLineIndex = lines.findIndex(line => /confirm/i.test(line));

  if (confirmLineIndex >= 0) {
    startIndex = confirmLineIndex + 1;

    for (let i = startIndex; i < lines.length; i++) {
      if (stopMarkers.some(re => re.test(lines[i]))) {
        stopIndex = i;
        break;
      }
    }
  }

  // ======================
  // GENDER LOOKUP (multi-language)
  // ======================
  const genderLookup = {};

  if (typeof translations !== "undefined") {
    Object.values(translations).forEach(langObj => {
      if (langObj.male)
        genderLookup[langObj.male.toLowerCase()] = "Male";

      if (langObj.female)
        genderLookup[langObj.female.toLowerCase()] = "Female";
    });
  }

  // fallback English
  genderLookup["male"] = "Male";
  genderLookup["m"] = "Male";
  genderLookup["female"] = "Female";
  genderLookup["f"] = "Female";

  // ======================
  // EXTRACT NAMES
  // ======================
  const extractedNames = [];

  for (let i = startIndex; i < stopIndex; i++) {

    let line = lines[i].trim();
    if (!line) continue;
    if (/https?/i.test(line)) continue;

    let gender = defaultGender;

    // remove numbering (1. John → John)
    const match = line.match(/^(\d+\.?\s*)?(.*)$/);
    if (match) line = match[2].trim();

    // ======================
    // name, gender
    // ======================
    if (line.includes(",")) {
      const parts = line.split(",").map(p => p.trim());

      line = parts[0];

      if (parts[1]) {
        const g = parts[1].toLowerCase();
        if (genderLookup[g]) gender = genderLookup[g];
      }
    }

    // ======================
    // name (gender)
    // ======================
    const parenMatch = line.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const inside = parenMatch[1].trim().toLowerCase();

      if (genderLookup[inside])
        gender = genderLookup[inside];

      line = line.replace(/\([^)]+\)/, "").trim();
    }

    if (!line) continue;

    const normalized = line.toLowerCase();

    // avoid duplicates globally + in this import
    const exists =
      schedulerState.allPlayers.some(
        p => p.name.trim().toLowerCase() === normalized
      ) ||
      extractedNames.some(
        p => p.name.trim().toLowerCase() === normalized
      );

    if (!exists) {
      extractedNames.push({
        name: line,
        gender,
        active: true
      });
    }
  }

  if (extractedNames.length === 0) return;

  // ======================
  // SAVE
  // ======================
  schedulerState.allPlayers.push(...extractedNames);

  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

  updatePlayerList();
  updateFixedPairSelectors();
  hideImportModal();
}



/* =========================
 
PLAYER MANAGEMENT
 
========================= */

function createPlayerCard(player, index) {
  let cardClass = `player-edit-card player-row ${player.gender.toLowerCase()}`;
  if (!player.active) cardClass += " inactive";

  const card = document.createElement("div");
  card.className = cardClass;

  // 🔹 Drag support
  card.draggable = true;
  card.dataset.index = index;
  card.addEventListener("dragstart", onDragStart);
  card.addEventListener("dragover", onDragOver);
  card.addEventListener("drop", onDrop);

  const genderIcon =
    player.gender === "Male" ? "👨‍💼" :
    player.gender === "Female" ? "🙎‍♀️" :
    "❔";

  card.innerHTML = `
    <div class="pec-col pec-active">
      <input type="checkbox"
        ${player.active ? "checked" : ""}
        onchange="toggleActive(${index}, this)">
    </div>

    <div class="pec-col pec-sl">${index + 1}</div>

    <div class="pec-col pec-gender">
      <span class="gender-icon ${player.gender.toLowerCase()}"
            onclick="toggleGender(${index}, this)">
        ${genderIcon}
      </span>
    </div>

    <div class="pec-col pec-name"
         onclick="editPlayerName(${index})">
      ${player.name}
    </div>

    <div class="pec-col pec-delete">
      <button class="pec-btn delete"
              onclick="deletePlayer(${index})">🗑</button>
    </div>
  `;

  return card;
}

function editPlayerName(index) {
  const oldPlayer = schedulerState.allPlayers[index];
  const oldName = oldPlayer.name;

  const newName = prompt("Edit player name", oldName);
  if (!newName) return;

  const trimmed = newName.trim();
  if (!trimmed) return;

  const duplicate = schedulerState.allPlayers.some(
    (p, i) =>
      i !== index &&
      p.name.toLowerCase() === trimmed.toLowerCase()
  );

  if (duplicate) {
    alert("Player name already exists!");
    return;
  }

  // ✅ immutable update
  schedulerState.allPlayers = schedulerState.allPlayers.map((p, i) =>
    i === index ? { ...p, name: trimmed } : p
  );

  updatePlayerList();
}

let draggedIndex = null;

function onDragStart(e) {
  draggedIndex = Number(e.currentTarget.dataset.index);
  e.dataTransfer.effectAllowed = "move";
}

function onDragOver(e) {
  e.preventDefault(); // Allow drop
}

function onDrop(e) {
  const targetIndex = Number(e.currentTarget.dataset.index);
  if (draggedIndex === targetIndex) return;

  const list = schedulerState.allPlayers;
  const [moved] = list.splice(draggedIndex, 1);
  list.splice(targetIndex, 0, moved);

  updatePlayerList();
}



function xxxcreatePlayerCard(player, index) {
  // Base card class + gender
  let cardClass = `player-edit-card player-row ${player.gender.toLowerCase()}`;
  
  // Add 'inactive' class if player is not active
  if (!player.active) {
    cardClass += " inactive";
  }

  const card = document.createElement("div");
  card.className = cardClass;

  // Gender icon
  const genderIcon =
    player.gender === "Male" ? "👨‍💼" :
    player.gender === "Female" ? "🙎‍♀️" :
    "❔";

  card.innerHTML = `
    <div class="pec-col pec-active">
      <input type="checkbox"
        ${player.active ? "checked" : ""}
        onchange="toggleActive(${index}, this)">
    </div>
    <div class="pec-col pec-sl">${index + 1}</div>
    <div class="pec-col pec-gender">
      <span class="gender-icon ${player.gender.toLowerCase()}"
      onclick="toggleGender(${index}, this)">
  ${genderIcon}
</span>
    </div> 

    <div class="pec-col pec-name">${player.name}</div>    

    <div class="pec-col pec-delete">
      <button class="pec-btn delete" onclick="deletePlayer(${index})">🗑</button>
    </div>
  `;

  return card;
}
/*
========================
   UPDATE PLAYER LIST TABLE
========================= */
function reportold1() {
  const table = document.getElementById('page3-table');
  table.innerHTML = `
    <tr>
      <th>No</th>
      <th>Name</th>
      <th>P/R</th>
    </tr>
  `;

  schedulerState.allPlayers.forEach((p, i) => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <!-- No -->
      <td class="no-col" style="text-align:center; font-weight:bold;">
        ${i + 1}
      </td>

      <!-- Name (plain text) -->
      <td class="Player-cell">
        ${p.name}
      </td>

      <!-- Played / Rest circles -->
      <td class="stat-cell">
        <span class="played-count" id="played_${i}"></span>
        <span class="rest-count" id="rest_${i}"></span>
      </td>
    `;

    // 🔥 Update Played circle
    const playedElem = row.querySelector(`#played_${i}`);
    if (playedElem) {
      const playedValue = schedulerState.PlayedCount.get(p.name) || 0;
      playedElem.textContent = playedValue;
      playedElem.style.borderColor = getPlayedColor(playedValue);
    }

    // 🔥 Update Rest circle
    const restElem = row.querySelector(`#rest_${i}`);
    if (restElem) {
      const restValue = schedulerState.restCount.get(p.name) || 0;
      restElem.textContent = restValue;
      restElem.style.borderColor = getRestColor(restValue);
    }

    table.appendChild(row);
  });
}

function updatePlayerList() {
  const container = document.getElementById("playerList");
  container.innerHTML = "";

  schedulerState.allPlayers.forEach((player, index) => {
    const card = createPlayerCard(player, index);
    container.appendChild(card);
  });
  // Recalculate active players list
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
	.reverse();

  // Refresh UI
  updateFixedPairSelectors();
	
  updateCourtButtons()
  updateRoundsPageAccess(); 	
}

function oldupdatePlayerList() {
  const table = document.getElementById('player-list-table');
  table.innerHTML = `
    <tr>
      <th>No</th>
      <th></th>
      <th>Name</th>
      <th>M/F</th>
      <th>Del</th>
    </tr>
  `;

  schedulerState.allPlayers.forEach((p, i) => {
    const row = document.createElement('tr');
    if (!p.active) row.classList.add('inactive');

    row.innerHTML = `
      <!-- No. -->
      <td class="no-col" style="text-align:center; font-weight:bold;">${i + 1}</td>

      <!-- Active checkbox -->
      <td style="text-align:center;">
        <input type="checkbox" ${p.active ? 'checked' : ''}
          onchange="editPlayer(${i}, 'active', this.checked)">
      </td>

      <!-- Name -->
      <td class="Player-cell">
        <input type="text" value="${p.name}"
          ${!p.active ? 'disabled' : ''}
          onchange="editPlayer(${i}, 'name', this.value)">
      </td>

      <!-- Gender -->
      <td class="gender-cell">
        <label class="gender-btn male">
          <input type="radio" name="gender-${i}" value="Male"
            ${p.gender === 'Male' ? 'checked' : ''}
            onchange="editPlayer(${i}, 'gender', 'Male')">
          <span>M</span>
        </label>
        <label class="gender-btn female">
          <input type="radio" name="gender-${i}" value="Female"
            ${p.gender === 'Female' ? 'checked' : ''}
            onchange="editPlayer(${i}, 'gender', 'Female')">
          <span>F</span>
        </label>
      </td>

      <!-- Delete button col -->
      <td style="text-align:center;">
        <button onclick="deletePlayer(${i})">🗑️</button>
      </td>
    `;  // <-- ⬅ HERE: properly closed backtick!

    table.appendChild(row);
  });
}



function getPlayedColor(value) {
  if (!value || value <= 0) return "#e0e0e0";

  const plays = Math.min(value, 20);
  const hue = (plays - 1) * 36; // 36° steps → 10 distinct, bold colors: 0°, 36°, 72°, ..., 684° → wraps cleanly

  return `hsl(${hue}, 92%, 58%)`;
}

function getRestColor(value) {
  if (!value || value <= 0) return "#e0e0e0";

  const rests = Math.min(value, 20);
  const hue = ((rests - 1) * 36 + 180) % 360; // +180° offset = perfect opposite color

  return `hsl(${hue}, 88%, 62%)`;
}




let selectedNoCell = null;

function enableTouchRowReorder() {
  const table = document.getElementById("player-list-table");
  Array.from(table.querySelectorAll(".no-col")).forEach(cell => {
    cell.addEventListener("click", onNumberTouch);
    cell.addEventListener("touchend", onNumberTouch);
  });
}

function onNumberTouch(e) {
  e.preventDefault();
  const cell = e.currentTarget;
  const sourceRow = selectedNoCell ? selectedNoCell.parentElement : null;
  const targetRow = cell.parentElement;

  // Select first row
  if (!sourceRow) {
    selectedNoCell = cell;
    cell.classList.add("selected-no");
    return;
  }

  // Unselect if same row
  if (sourceRow === targetRow) {
    selectedNoCell.classList.remove("selected-no");
    selectedNoCell = null;
    return;
  }

  const table = document.getElementById("player-list-table");

  // Move source row AFTER target row
  const nextSibling = targetRow.nextSibling;
  table.insertBefore(sourceRow, nextSibling);

  // Clear selection
  selectedNoCell.classList.remove("selected-no");
  selectedNoCell = null;

  // Update No. column
  updateNumbers();
  syncPlayersFromTable();
}


function updateNumbers() {
  const table = document.getElementById("player-list-table");
  Array.from(table.querySelectorAll(".no-col")).forEach((cell, idx) => {
    cell.textContent = idx + 1;
  });
}

function syncPlayersFromTable() {
  const table = document.getElementById('player-list-table');
  const rows = table.querySelectorAll('tr');

  const updated = [];

  rows.forEach((row, index) => {
    if (index === 0) return; // skip header

    const nameCell = row.querySelector('.player-name');
    const genderCell = row.querySelector('.player-gender');

    if (!nameCell || !genderCell) return;

    updated.push({
      name: nameCell.textContent.trim(),
      gender: genderCell.textContent.trim(),
      active: !row.classList.contains('inactive-row')
    });
  });

  // Update your global arrays
  schedulerState.allPlayers = updated;
  schedulerState.activeplayers = schedulerState.allPlayers
    .filter(p => p.active)
    .map(p => p.name)
    .reverse();

}


// Function to toggle all checkboxes
function toggleAllCheckboxes(masterCheckbox) {
  // Only run if the checkbox exists and event came from it
  if (!masterCheckbox || masterCheckbox.id !== 'select-all-checkbox') return;
  const checkboxes = document.querySelectorAll('#player-list-table td:first-child input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
}
/* =========================
   FIXED PAIRS MANAGEMENT
========================= */
function oldupdateFixedPairSelectors() {
  const sel1 = document.getElementById('fixed-pair-1');
  const sel2 = document.getElementById('fixed-pair-2');
  const pairedPlayers = new Set(schedulerState.fixedPairs.flat());
  sel1.innerHTML = '<option value="" data-i18n="selectPlayer1"></option>';
  sel2.innerHTML = '<option value="" data-i18n="selectPlayer2"></option>';
  //sel2.innerHTML = '<option value="">-- Select Player 2 --</option>';
  // Only active players
  schedulerState.activeplayers.slice().reverse().forEach(p => {
    if (!pairedPlayers.has(p)) {
      const option1 = document.createElement('option');
      const option2 = document.createElement('option');
      option1.value = option2.value = p;
      option1.textContent = option2.textContent = p;
      sel1.appendChild(option1);
      sel2.appendChild(option2);
    }
  });
}

function modifyFixedPair(p1 = null, p2 = null) {
  // If called from delete button (icon), values passed.
  // If called from main button, read from selectors:
  if (!p1 || !p2) {
    p1 = document.getElementById('fixed-pair-1').value;
    p2 = document.getElementById('fixed-pair-2').value;
  }

  if (!p1 || !p2) {
    alert("Please select both players.");
    return;
  }

  if (p1 === p2) {
    alert("You cannot pair the same player with themselves.");
    return;
  }

  const pairKey = [p1, p2].sort().join('&');

  // Check if pair already exists
  const index = schedulerState.fixedPairs.findIndex(
    pair => pair.sort().join('&') === pairKey
  );

  // -------------------------
  // REMOVE if exists
  // -------------------------
  if (index !== -1) {
    schedulerState.fixedPairs.splice(index, 1);
    removeFixedCard(pairKey);
    updateFixedPairSelectors();
    return;
  }

  // -------------------------
  // ADD if does not exist
  // -------------------------
  schedulerState.fixedPairs.push([p1, p2]);
  addFixedCard(p1, p2, pairKey);
  updateFixedPairSelectors();
}

function oldaddFixedCard(p1, p2, key) {
  const list = document.getElementById('fixed-pair-list');

  const card = document.createElement("div");
  card.className = "fixed-card";
  card.setAttribute("data-key", key);

  card.innerHTML = `
    
    <div class="fixed-name">${p1} & ${p2}</div>
    <div class="fixed-delete">
      <button class="pec-btn delete"
              onclick="modifyFixedPair('${p1}', '${p2}')">🗑</button>
    </div>
  `;

  list.appendChild(card);
}

function removeFixedCard(key) {
  const card = document.querySelector(`[data-key="${key}"]`);
  if (card) card.remove();
}

function addFixedPairold() {
  const p1 = document.getElementById('fixed-pair-1').value;
  const p2 = document.getElementById('fixed-pair-2').value;
  if (!p1 || !p2) {
    alert("Please select both players.");
    return;
  }
  if (p1 === p2) {
    alert("You cannot pair the same player with themselves.");
    return;
  }
  const pairKey = [p1, p2].sort().join('&');
  const alreadyExists = schedulerState.fixedPairs.some(pair => pair.sort().join('&') === pairKey);
  if (alreadyExists) {
    alert(`Fixed pair "${p1} & ${p2}" already exists.`);
    return;
  }
  schedulerState.fixedPairs.push([p1, p2]);
  const div = document.createElement('div');
  div.classList.add('fixed-pair-item');
  div.innerHTML = `
    ${p1} & ${p2}
    <span class="fixed-pair-remove" onclick="removeFixedPair(this, '${p1}', '${p2}')">
      Remove
    </span>
  `;
  document.getElementById('fixed-pair-list').appendChild(div);
  updateFixedPairSelectors();
}
function removeFixedPair(el, p1, p2) {
  schedulerState.fixedPairs = schedulerState.fixedPairs.filter(pair => !(pair[0] === p1 && pair[1] === p2));
  el.parentElement.remove();
  updateFixedPairSelectors();
}

/* =========================
 
PAGE NAVIGATION
 
========================= */

function showToast(msg) {
  if (!msg) return; // ⛔ nothing to show

  const toast = document.getElementById("toast");
  if (!toast) return; // ⛔ toast element not present

  toast.textContent = msg;
  toast.classList.remove("hidden");

  setTimeout(() => {
    if (toast) toast.classList.add("hidden");
  }, 2500);
}


function alert(msg) {
  showToast(msg);   // your toast function
}


/* =========================
   NEW IMPORT MODULE JS (Prefixed)
========================= */

// State
// ======================
const newImportState = {
  enterPlayers: [],
  dbPlayers: [],
  historyPlayers: [],
  favoritePlayers: [],
  currentSelectMode: "registered"
};

// ======================
// DOM (wait until ready)
// ======================
let newImportModal;
let newImportEnterCards;
let newImportSelectCards;
let newImportTextarea;

document.addEventListener("DOMContentLoaded", () => {
  newImportModal = document.getElementById("newImportModal");
  newImportEnterCards = document.getElementById("newImportEnterCards");
  newImportSelectCards = document.getElementById("newImportSelectCards");
  newImportTextarea = document.getElementById("newImport-textarea");

  if (!newImportModal || !newImportEnterCards || !newImportSelectCards || !newImportTextarea) {
    console.error("NewImport: Missing required DOM elements");
    return;
  }

  newImportTextarea.addEventListener("input", debounce(newImportProcessTextarea, 250));
  newImportSelectCards.addEventListener("click", newImportHandleSelectClick);
});

// ======================
// HELPERS
// ======================
function debounce(func, delay = 250) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// ======================
// MODAL
// ======================
function newImportShowModal() {
  newImportModal.style.display = "block";
  newImportShowTab('enter');
  newImportLoadDatabase();
  newImportLoadHistory();
  newImportLoadFavorites();
  newImportRefreshEnterCards();
  newImportRefreshSelectCards();
}
function newImportHideModal() {
  newImportModal.style.display = "none";
  newImportTextarea.value = "";
  newImportState.enterPlayers = [];
  newImportRefreshEnterCards();
}

// ======================
// TAB SWITCH
// ======================
function newImportShowTab(tab) {
  document.querySelectorAll('.newImport-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.newImport-tab-content').forEach(tabDiv => tabDiv.classList.add('hidden'));
  if (tab === 'enter') {
    document.getElementById('newImportEnterTabBtn').classList.add('active');
    document.getElementById('newImportEnterTab').classList.remove('hidden');
  } else {
    document.getElementById('newImportSelectTabBtn').classList.add('active');
    document.getElementById('newImportSelectTab').classList.remove('hidden');
  }
}

// ======================
// SUB MODE SWITCH
// ======================
function newImportShowSelectMode(mode) {
  newImportState.currentSelectMode = mode;
  document.querySelectorAll(".newImport-subtab-btn").forEach(btn => btn.classList.remove("active"));
  const btnId = "newImport" + mode.charAt(0).toUpperCase() + mode.slice(1) + "Btn";
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add("active");
  newImportRefreshSelectCards();
}

// ======================
// STORAGE
// ======================
function newImportLoadDatabase() {
  const db = localStorage.getItem("newImportPlayersDB");
  newImportState.dbPlayers = db ? JSON.parse(db) : [];
}
function newImportLoadHistory() {
  const data = localStorage.getItem("newImportHistory");
  newImportState.historyPlayers = data ? JSON.parse(data) : [];
}
function newImportLoadFavorites() {
  const data = localStorage.getItem("newImportFavorites");
  newImportState.favoritePlayers = data ? JSON.parse(data) : [];
}
function newImportSaveHistory() {
  localStorage.setItem("newImportHistory", JSON.stringify(newImportState.historyPlayers));
}
function newImportSaveFavorites() {
  localStorage.setItem("newImportFavorites", JSON.stringify(newImportState.favoritePlayers));
}

// ======================
// TEXT INPUT PROCESSING
// ======================
function newImportProcessTextarea() {
  const text = newImportTextarea.value;
  if (!text.trim()) {
    newImportState.enterPlayers = [];
    newImportRefreshEnterCards();
    newImportRefreshSelectCards();
    return;
  }
  const lines = text.split(/\r?\n/);
  const genderLookup = {
    male: "Male",
    m: "Male",
    female: "Female",
    f: "Female"
  };
  const extracted = [];
  lines.forEach((rawLine, index) => {
    let line = rawLine.trim();
    if (!line) return;
    const isLastLine = index === lines.length - 1;
    const endsWithNewLine = text.endsWith("\n") || text.endsWith("\r");
    if (isLastLine && !endsWithNewLine) return;
    if (line.toLowerCase().includes("http")) return;
    let gender = "Male";
    // remove numbering
    const match = line.match(/^(\d+\.?\s*)?(.*)$/);
    if (match) line = match[2].trim();
    // comma gender
    if (line.includes(",")) {
      const parts = line.split(",").map(p => p.trim());
      line = parts[0];
      const g = parts[1]?.toLowerCase();
      if (genderLookup[g]) gender = genderLookup[g];
    }
    // (gender)
    const parenMatch = line.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const inside = parenMatch[1].trim().toLowerCase();
      if (genderLookup[inside]) gender = genderLookup[inside];
      line = line.replace(/\([^)]+\)/, "").trim();
    }
    if (!line) return;
    const exists =
      extracted.some(p => p.displayName.toLowerCase() === line.toLowerCase()) ||
      newImportState.enterPlayers.some(p => p.displayName.toLowerCase() === line.toLowerCase());
    if (!exists) extracted.push({ displayName: line, gender });
  });
  if (extracted.length > 0) {
    newImportState.enterPlayers.push(...extracted);
    newImportRefreshEnterCards();
    newImportRefreshSelectCards();
  }
}

// ======================
// ENTER CARDS
// ======================
function newImportRefreshEnterCards() {
  newImportEnterCards.innerHTML = "";
  newImportState.enterPlayers.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = `newImport-player-card newImport-${p.gender.toLowerCase()}`;
    card.innerHTML = `
      <img src="${p.gender === "Male" ? "male.png" : "female.png"}"
        class="newImport-gender-icon"
        data-index="${i}">
      <span class="newImport-player-name">${p.displayName}</span>
      <button class="newImport-remove-btn" data-index="${i}">×</button>
      <button class="newImport-fav-btn" data-index="${i}">★</button>
    `;
    newImportEnterCards.appendChild(card);
    // toggle gender
    card.querySelector(".newImport-gender-icon").onclick = (e) => {
      const idx = parseInt(e.target.dataset.index);
      newImportState.enterPlayers[idx].gender =
        newImportState.enterPlayers[idx].gender === "Male"
          ? "Female"
          : "Male";
      newImportRefreshEnterCards();
    };
    // remove
    card.querySelector(".newImport-remove-btn").onclick = (e) => {
      const idx = parseInt(e.target.dataset.index);
      newImportState.enterPlayers.splice(idx, 1);
      newImportRefreshEnterCards();
      newImportRefreshSelectCards();
    };
    // favorite
    card.querySelector(".newImport-fav-btn").onclick = (e) => {
      const idx = parseInt(e.target.dataset.index);
      const player = newImportState.enterPlayers[idx];
      if (!newImportState.favoritePlayers.some(p => p.displayName === player.displayName)) {
        newImportState.favoritePlayers.push({ ...player });
        newImportSaveFavorites();
      }
    };
  });
}

// ======================
// SELECT CARDS
// ======================
function newImportRefreshSelectCards() {
  newImportSelectCards.innerHTML = "";
  let source = [];
  if (newImportState.currentSelectMode === "history")
    source = newImportState.historyPlayers;
  else if (newImportState.currentSelectMode === "favorites")
    source = newImportState.favoritePlayers;
  else
    source = newImportState.dbPlayers;
  source.forEach((p, i) => {
    const alreadyAdded =
      newImportState.enterPlayers.some(
        ep => ep.displayName.toLowerCase() === p.displayName.toLowerCase()
      );
    const card = document.createElement("div");
    card.className = `newImport-player-card newImport-${p.gender.toLowerCase()}`;
    card.innerHTML = `
      <img src="${p.gender === "Male" ? "male.png" : "female.png"}"
        class="newImport-gender-icon">
      <span class="newImport-player-name">${p.displayName}</span>
      <button class="newImport-add-btn"
        data-index="${i}"
        ${alreadyAdded ? "disabled" : ""}>
        ${alreadyAdded ? "✓" : "+"}
      </button>
    `;
    newImportSelectCards.appendChild(card);
  });
}

// ======================
// SELECT CLICK HANDLER
// ======================
function newImportHandleSelectClick(e) {
  if (!e.target.classList.contains("newImport-add-btn")) return;
  const idx = parseInt(e.target.dataset.index);
  let source = [];
  if (newImportState.currentSelectMode === "history")
    source = newImportState.historyPlayers;
  else if (newImportState.currentSelectMode === "favorites")
    source = newImportState.favoritePlayers;
  else
    source = newImportState.dbPlayers;
  const player = source[idx];
  if (!newImportState.enterPlayers.some(
    ep => ep.displayName.toLowerCase() === player.displayName.toLowerCase()
  )) {
    newImportState.enterPlayers.push({ ...player });
    newImportRefreshEnterCards();
    newImportRefreshSelectCards();
  }
}

// ======================
// FINAL ADD
// ======================
function newImportAddPlayers() {
  if (newImportState.enterPlayers.length === 0) {
    alert("No players to add!");
    return;
  }
  // save to DB
  newImportState.enterPlayers.forEach(p => {
    if (!newImportState.dbPlayers.some(dp => dp.displayName === p.displayName)) {
      newImportState.dbPlayers.push({ ...p });
    }
  });
  localStorage.setItem("newImportPlayersDB", JSON.stringify(newImportState.dbPlayers));
  // append history
  newImportState.historyPlayers = [
    ...newImportState.enterPlayers,
    ...newImportState.historyPlayers
  ].slice(0, 50);
  newImportSaveHistory();
  // external export (your existing function)
  if (typeof addPlayersFromText === "function") {
    addPlayersFromText(newImportState.enterPlayers);
  }
  newImportHideModal();
}
