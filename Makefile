# Postfach: Prüfkette. `make check` führt alles aus; eine Stufe allein läuft mit ihrem Namen (make wege).
# Nur bestimmte Szenarien rendern: make render SZENARIEN="leer fehler"; Zahl der Jobs: make render JOBS=3.
# Der Renderer gehört zu p94-hig und wird nicht kopiert: HIG zeigt auf den Klon (make check HIG=PFAD).
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

HIG ?= ../p94-hig
BILDER ?= bilder
NODE ?= node
SZENARIEN ?=
JOBS ?=
# Jobs, die alle Stufen von make check zusammen nutzen dürfen; make check rechnet sie einmal und gibt sie an die Stufen weiter.
# Ohne BUDGET (eine Stufe allein) wählt der Renderer selbst. Ein Job ist 1,2 GB (JOB_MB in tools/rendern.mjs).
BUDGET ?=
# Gleichzeitige Testdateien von node --test; die Vorgabe von node (Kerne minus 1) zählt die Chromium-Stufen nicht mit.
TEST_JOBS ?= 2

.PHONY: check stufen test fremdhost secrets render wege symbole

# Die fünf Stufen teilen weder Ports (jede wählt einen freien) noch Dateien (Profile in eigenen Temp-Ordnern, Bilder nur in
# BILDER), darum laufen sie gleichzeitig. -k lässt jede Stufe zu Ende laufen, damit alle Fehler auf einmal erscheinen;
# --output-sync=target druckt die Ausgabe je Stufe am Stück, wenn sie fertig ist. Ein Fehler jeder Stufe lässt check scheitern.
# -j5 ist die Zahl der Stufen, nicht der Prozesse: die Last begrenzt BUDGET (aus claude-jobs mit 1,2 GB je Chromium;
# ohne claude-jobs 2).
check:
	@b="$(BUDGET)"; [ -n "$$b" ] || b=$$(claude-jobs --mem 1.2 2>/dev/null || echo 2); \
	$(MAKE) --no-print-directory -j5 -k --output-sync=target stufen BUDGET=$$b

# render und wege laufen am längsten, darum zuerst
stufen: render wege test fremdhost secrets

test:
	$(NODE) --test --test-concurrency=$(TEST_JOBS) tests/

fremdhost:
	$(NODE) tools/fremdhost.mjs

# --redact: ein Fund zeigt nie das Geheimnis selbst
secrets:
	gitleaks dir --no-banner --redact .

# Rendert jede Ansicht in jedem Zustand (Szenarien mit erfundenen Daten: tests/hilfen/beispieldaten.mjs) in beiden Größen,
# hell, dunkel, Schrift 200 % und ohne Netz und prüft Manifest und Start ohne Netz. Verlangt PASS: auch ein WARN
# lässt die Stufe scheitern. Der Renderer ist rendern-mobil.mjs aus p94-hig; tools/rendern.mjs startet ihn je Szenario.
render:
	@test -f "$(HIG)/beispiele/rendern-mobil.mjs" || { \
	  echo "make: Fehler: $(HIG)/beispiele/rendern-mobil.mjs fehlt" >&2; \
	  echo "Gib den Klon von p94-hig an: make check HIG=PFAD" >&2; exit 1; }
	@mkdir -p "$(BILDER)"
	$(NODE) tools/rendern.mjs --hig "$(HIG)" -o "$(BILDER)" $(if $(JOBS),--jobs $(JOBS),$(if $(BUDGET),--jobs $$(b=$(BUDGET); echo $$(( b > 2 ? b - 1 : 1 ))))) $(SZENARIEN)
	@if grep -q '^[a-z-]*: WARN' "$(BILDER)/lauf.txt"; then echo "make: Fehler: das Rendern meldet WARN, verlangt ist PASS" >&2; echo "Die Zeilen mit WARN stehen in $(BILDER)/lauf.txt." >&2; exit 1; fi

wege:
	$(NODE) tools/wege.mjs

# Bilder des Symbols aus tools/symbol.svg; braucht rsvg-convert, gehört nicht zu make check
symbole:
	$(NODE) tools/symbole.mjs
