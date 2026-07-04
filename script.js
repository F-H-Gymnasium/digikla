// Beim Start direkt die gespeicherten Schüler laden
document.addEventListener("DOMContentLoaded", ladenAusSpeicher);

function schuelerHinzufuegen() {
    let input = document.getElementById("schuelerName");
    let name = input.value.trim();
    
    if (name === "") return;

    let schuelerListe = holenAusSpeicher();
    
    // Neuen Schüler als Objekt hinzufügen
    schuelerListe.push({ name: name, status: "Anwesend" });
    speichernInSpeicher(schuelerListe);
    
    input.value = ""; // Feld leeren
    tabelleAnzeigen();
}

function loeschen(index) {
    let schuelerListe = holenAusSpeicher();
    schuelerListe.splice(index, 1); // Entfernt den Schüler an der Stelle X
    speichernInSpeicher(schuelerListe);
    tabelleAnzeigen();
}

function statusAendern(index, neuerStatus) {
    let schuelerListe = holenAusSpeicher();
    schuelerListe[index].status = neuerStatus;
    speichernInSpeicher(schuelerListe);
}

function tabelleAnzeigen() {
    let tbody = document.getElementById("schuelerListe");
    tbody.innerHTML = ""; // Tabelle leeren
    
    let schuelerListe = holenAusSpeicher();
    
    schuelerListe.forEach((schueler, index) => {
        let row = document.createElement("tr");
        
        row.innerHTML = `
            <td>${schueler.name}</td>
            <td>
                <select onchange="statusAendern(${index}, this.value)">
                    <option value="Anwesend" ${schueler.status === 'Anwesend' ? 'selected' : ''}>Anwesend</option>
                    <option value="Fehlt" ${schueler.status === 'Fehlt' ? 'selected' : ''}>Fehlt</option>
                    <option value="Verspätet" ${schueler.status === 'Verspätet' ? 'selected' : ''}>Verspätet</option>
                </select>
            </td>
            <td><button class="delete-btn" onclick="loeschen(${index})">Löschen</button></td>
        `;
        
        tbody.appendChild(row);
    });
}

// Hilfsfunktionen für den LocalStorage (Browser-Speicher)
function speichernInSpeicher(liste) {
    localStorage.setItem("robloxKlassenbuch", JSON.stringify(liste));
}

function holenAusSpeicher() {
    let daten = localStorage.getItem("robloxKlassenbuch");
    return daten ? JSON.parse(daten) : [];
}

function ladenAusSpeicher() {
    tabelleAnzeigen();
}
