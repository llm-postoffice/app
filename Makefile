# Postfach: Prüfkette. `make check` führt alles aus; eine Stufe allein läuft mit ihrem Namen (make wege).
# Der Renderer gehört zu p94-hig und wird nicht kopiert: HIG zeigt auf den Klon (make check HIG=PFAD).
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

HIG ?= ../p94-hig
BILDER ?= bilder
NODE ?= node

.PHONY: check test fremdhost secrets render wege

check: test fremdhost secrets render wege

test:
	$(NODE) --test tests/

fremdhost:
	$(NODE) tools/fremdhost.mjs

# --redact: ein Fund zeigt nie das Geheimnis selbst
secrets:
	gitleaks dir --no-banner --redact .

# Rendert jede Ansicht in jedem Zustand (Szenarien mit erfundenen Daten: tests/hilfen/beispieldaten.mjs) in beiden Größen,
# hell, dunkel, Schrift 200 % und ohne Netz und prüft Manifest und Start ohne Netz (UEW-2). Verlangt PASS: auch ein WARN
# lässt die Stufe scheitern. Der Renderer ist rendern-mobil.mjs aus p94-hig; tools/rendern.mjs startet ihn je Szenario.
render:
	@test -f "$(HIG)/beispiele/rendern-mobil.mjs" || { \
	  echo "make: Fehler: $(HIG)/beispiele/rendern-mobil.mjs fehlt" >&2; \
	  echo "Gib den Klon von p94-hig an: make check HIG=PFAD" >&2; exit 1; }
	@mkdir -p "$(BILDER)"
	$(NODE) tools/rendern.mjs --hig "$(HIG)" -o "$(BILDER)"
	@if grep -q '^[a-z-]*: WARN' "$(BILDER)/lauf.txt"; then echo "make: Fehler: das Rendern meldet WARN; verlangt ist PASS" >&2; exit 1; fi

wege:
	$(NODE) tools/wege.mjs
