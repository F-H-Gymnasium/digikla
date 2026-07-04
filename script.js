// Globale Variablen für den aktuellen Zustand
let gewaehlteStunde = null;

// Beim Start heutiges Datum setzen und Daten laden
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("aktuellesDatum").valueAsDate = new Date();
    stundenButtonsErstellen();
    ansichtAktualisieren();
});

// Erstellt die Buttons für die Schulstunden (1. bis 6. Stunde)
function stundenButtonsErstellen() {
    const container = document.getElementById("stundenListe");
    container.innerHTML = "";
    for (let i = 1; i <= 6; i++) {
        let btn = document.createElement("button");
        btn.className = "stunde-btn";
        btn.innerText = `${i}. Std`;
        btn.onclick = () => stundeWaehlen(i, btn);
        container.appendChild(btn);
    }
}

function stundeWaehlen(stunde, button) {
    gewaehlteStunde = stunde;
    
    // Aktiven Button blau färben
    document.querySelectorAll(".stunde-btn").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    
    document.getElementById("aktuelleStundeTitel").innerText = `${stunde}. Schulstunde`;
    document.getElementById("anwesenheitsTabelle").style.display = "table";
    
    tabelleAnzeigen();
}

function ansichtAktualisieren() {
    if (gewaehlteStunde) {
        tabelleAnzeigen();
    }
}

// Schüler zur allgemeinen Datenbank hinzufügen
function schuelerHinzufuegen() {
    let input = document.getElementById("neuerSchuelerName");
    let name = input.value.trim();
    if (name === "") return;

    let daten = holenAusSpeicher();
    if (!daten.schueler.includes(name)) {
        daten.schueler.push(name);
        speichernInSpeicher(daten);
    }
    input.value = "";
    tabelleAnzeigen();
}

// Ändert den Status für ein bestimmtes Datum und eine bestimmte Stunde
function statusAendern(schuelerName, neuerStatus) {
    let datum = document.getElementById("aktuellesDatum").value;
    let daten = holenAusSpeicher();
    
    // Schlüssel-Format für den Speicher: "2026-07-04_Stunde1"
    let key = `${datum}_Std${gewaehlteStunde}`;
    
    if (!daten.eintraege[key]) {
        daten.eintraege[key] = {};
    }
    
    daten.eintraege[key][schuelerName] = neuerStatus;
    speichernInSpeicher(daten);
}

function tabelleAnzeigen() {
    if (!gewaehlteStunde) return;
    
    let tbody = document.getElementById("schuelerListeAnwesenheit");
    tbody.innerHTML = "";
    
    let datum = document.getElementById("aktuellesDatum").value;
    let rolle = document.getElementById("aktuelleRolle").value;
    let daten = holenAusSpeicher();
    
    let key = `${datum}_Std${gewaehlteStunde}`;
    let heutigeEintraege = daten.eintraege[key] || {};

    daten.schueler.forEach(name => {
        let aktuellerStatus = heutigeEintraege[name] || "Anwesend";
        let row = document.createElement("tr");
        
        // Berechtigungs-Logik für das Dropdown-Menü
        let optionen = `
            <option value="Anwesend" ${aktuellerStatus === 'Anwesend' ? 'selected' : ''}>Anwesend</option>
            <option value="Unentschuldigt" ${aktuellerStatus === 'Unentschuldigt' ? 'selected' : ''}>Unentschuldigt fehlt</option>
            <option value="Verspätet" ${aktuellerStatus === 'Verspätet' ? 'selected' : ''}>Verspätet</option>
        `;
        
        // Klassenleiter und Sekretariat dürfen MEHR Optionen sehen/wählen
        if (rolle === "Klassenleiter" || rolle === "Sekretariat") {
            optionen += `
                <option value="Entschuldigt" ${aktuellerStatus === 'Entschuldigt' ? 'selected' : ''}>Entschuldigt</option>
                <option value="Freigestellt" ${aktuellerStatus === 'Freigestellt' ? 'selected' : ''}>Freigestellt</option>
            `;
        } else {
            // Wenn der normale Lehrer aufruft, aber der Schüler bereits entschuldigt ist, zeigen wir es an
            if (aktuellerStatus === "Entschuldigt" || aktuellerStatus === "Freigestellt") {
                optionen += `<option value="${aktuellerStatus}" selected disabled>${aktuellerStatus} (durch Admin)</option>`;
            }
        }

        row.innerHTML = `
            <td><strong>${name}</strong></td>
            <td>
                <select class="status-select" onchange="statusAendern('${name}', this.value)">
                    ${optionen}
                </select>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Speicher-Hilfsfunktionen
function speichernInSpeicher(daten) {
    localStorage.setItem("robloxKlassenbuchErweitert", JSON.stringify(daten));
}

function holenAusSpeicher() {
    let daten = localStorage.getItem("robloxKlassenbuchErweitert");
    return daten ? JSON.parse(daten) : { schueler: [], eintraege: {} };
}
