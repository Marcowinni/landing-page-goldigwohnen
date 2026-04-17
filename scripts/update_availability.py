import re
import requests
from bs4 import BeautifulSoup

URL = "https://www.goldigwohnen.ch/angebot"

def fetch_counts():
    resp = requests.get(URL, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    verkauft = 0
    reserviert = 0
    for td in soup.find_all("td"):
        text = td.get_text(strip=True).lower()
        if text == "verkauft":
            verkauft += 1
        elif text == "reserviert":
            reserviert += 1

    return verkauft, reserviert

def update_html(vergeben):
    with open("index.html", "r", encoding="utf-8") as f:
        content = f.read()

    new_span = f'<strong>{vergeben} Einheiten</strong> bereits reserviert oder verkauft \u2013 jetzt Unterlagen sichern'
    updated = re.sub(
        r'<strong>\d+ Einheiten<\/strong> bereits reserviert oder verkauft \u2013 jetzt Unterlagen sichern',
        new_span,
        content
    )

    if updated == content:
        print("Keine Änderung notwendig.")
        return False

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(updated)
    print(f"Aktualisiert: {vergeben} Einheiten bereits vergeben.")
    return True

if __name__ == "__main__":
    verkauft, reserviert = fetch_counts()
    vergeben = verkauft + reserviert
    print(f"Verkauft: {verkauft} | Reserviert: {reserviert} | Total vergeben: {vergeben}")
    update_html(vergeben)
