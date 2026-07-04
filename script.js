// Dummy-Datenbank für Schüler & Beispiel-Stundenplan
const StandardSchueler = ["Lasse Neumann", "Klara Schuhmacher", "Maximilian Weber", "Emma Fischer"];
const StundenPlanStruktur = [
    { std: 1, zeit: "07:20 - 08:05", fach: "DE / Deu", lehrer: "ROIT" },
    { std: 2, zeit: "08:15 - 09:00", fach: "DE / Deu", lehrer: "ROIT" },
    { std: 3, zeit: "09:00 - 09:45", fach: "MA / Mat", lehrer: "ROIT" },
    { std: 4, zeit: "10:00 - 10:45", fach: "MA / Mat", lehrer: "ROIT" },
    { std: 5, zeit: "10:45 - 11:30", fach: "INF", lehrer: "FINN" }
];

let gewaehlteStundeNummer = null;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("aktuellesDatum").valueAsDate = new Date();
    datenLadenAndRendern();
});

function datenHolen() {
    let daten = localStorage.getItem("fuxKlassenbuchData");
    if (!daten) {
        return { eintraege: {} }; // Struktur für Datums- & Stundeneinträge
    }
    return JSON.parse(daten);
}

function datenSpeichern(daten) {
    localStorage.setItem("fuxKlassenbuchData", JSON.stringify(daten));
}

function datenLadenAndRendern() {
    let datum = document.getElementById("aktuellesDatum").value;
    let db = datenHolen();
    let tbody = document.getElementById("tagesStundenBody");
    tbody.innerHTML = "";

    StundenPlanStruktur.forEach(stunde => {
        let key = `${datum}_Std${stunde.std}`;
        let stundenDaten = db.eintraege[key] || { thema: "", hausaufgaben: "" };
        
        let row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${stunde.std}</strong> <br><small>${stunde.zeit}</small></td>
            <td><span class="btn btn-secondary">${stunde.fach}</span></td>
            <td>${stundenDaten.thema || "<em>Kein Eintrag</em>"}</td>
            <td>${stundenDaten.hausaufgaben || "-"}</td>
            <td>${stunde.lehrer}</td>
            <td><button class="btn btn-primary" onclick="oeffneStunde(${stunde.std})">Bearbeiten</button></td>
        `;
        tbody.appendChild(row);
    });
}

function oeffneStunde(stdNummer) {
    gewaehlteStundeNummer = stdNummer;
    let datum = document.getElementById("aktuellesDatum").value;
    let stundenInfo = StundenPlanStruktur.find(s => s.std === stdNummer);
    
    document.getElementById("detailStundeTitel").innerText = `${datum} - ${stundenInfo.std}. Std (${stundenInfo.fach})`;
    
    let db = datenHolen();
    let key = `${datum}_Std${stdNummer}`;
    let detail = db.eintraege[key] || { thema: "", hausaufgaben: "", anwesenheit: {} };
    
    // Inputs füllen
    document.getElementById("unterrichtsInhalt").value = detail.thema || "";
    document.getElementById("hausaufgabenInhalt").value = detail.hausaufgaben || "";
    
    // Anwesenheitsliste rendern
    let listeUl = document.getElementById("schuelerDetailListe");
    listeUl.innerHTML = "";
    
    let rolle = document.getElementById("aktuelleRolle").value;

    StandardSchueler.forEach(name => {
        let aktuellerStatus = detail.anwesenheit[name] || "Anwesend";
        
        let li = document.createElement("li");
        li.className = "schueler-item";
        
        let optionen = `
            <option value="Anwesend" ${aktuellerStatus === 'Anwesend' ? 'selected' : ''}>Anwesend</option>
            <option value="Unentschuldigt" ${aktuellerStatus === 'Unentschuldigt' ? 'selected' : ''}>Unentschuldigt fehlt</option>
            <option value="Verspätet" ${aktuellerStatus === 'Verspätet' ? 'selected' : ''}>Verspätet</option>
        `;
        
        // Rechteprüfung für Sekretariat und Klassenleiter
        if (rolle === "Klassenleiter" || rolle === "Sekretariat") {
            optionen += `
                <option value="Entschuldigt" ${aktuellerStatus === 'Entschuldigt' ? 'selected' : ''}>Entschuldigt</option>
                <option value="Freigestellt" ${aktuellerStatus === 'Freigestellt' ? 'selected' : ''}>Freigestellt</option>
            `;
        } else if (aktuellerStatus === "Entschuldigt" || aktuellerStatus === "Freigestellt") {
            optionen += `<option value="${aktuellerStatus}" selected disabled>${aktuellerStatus} (gesperrt)</option>`;
        }

        li.innerHTML = `
            <span>${name}</span>
            <select onchange="statusDirektSpeichern('${name}', this.value)" style="background:var(--bg-input); color:white; border:none; padding:5px; border-radius:4px;">
                ${optionen}
            </select>
        `;
        listeUl.appendChild(li);
    });

    document.getElementById("dashboardView").style.display = "none";
    document.getElementById("detailView").style.display = "block";
}

function statusDirektSpeichern(schuelerName, neuerStatus) {
    let datum = document.getElementById("aktuellesDatum").value;
    let db = datenHolen();
    let key = `${datum}_Std${gewaehlteStundeNummer}`;
    
    if (!db.eintraege[key]) db.eintraege[key] = { thema: "", hausaufgaben: "", anwesenheit: {} };
    if (!db.eintraege[key].anwesenheit) db.eintraege[key].anwesenheit = {};
    
    db.eintraege[key].anwesenheit[schuelerName] = neuerStatus;
    datenSpeichern(db);
}

function stundeSpeichernUndSchliessen() {
    let datum = document.getElementById("aktuellesDatum").value;
    let db = datenHolen();
    let key = `${datum}_Std${gewaehlteStundeNummer}`;
    
    if (!db.eintraege[key]) db.eintraege[key] = { thema: "", hausaufgaben: "", anwesenheit: {} };
    
    db.eintraege[key].thema = document.getElementById("unterrichtsInhalt").value;
    db.eintraege[key].hausaufgaben = document.getElementById("hausaufgabenInhalt").value;
    
    datenSpeichern(db);
    zeigeDashboard();
}

function zeigeDashboard() {
    document.getElementById("detailView").style.display = "none";
    document.getElementById("dashboardView").style.display = "block";
    datenLadenAndRendern();
}

