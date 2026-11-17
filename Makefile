# Postfach: Prüfkette. `make check` führt alles aus; eine Stufe allein läuft mit ihrem Namen (make wege).
# Der Renderer gehört zu p94-hig und wird nicht kopiert: HIG zeigt auf den Klon (make check HIG=PFAD).
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

HIG ?= ../p94-hig
BILDER ?= bilder
NODE ?= node

.PHONY: check test fremdhost secrets render wege apk apk-test sdk-vorhanden

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

# Android-Hülle (android/): Werkzeuge liegen unter XDG_DATA_HOME, nichts direkt in ~. Jede Vorgabe lässt sich beim
# Aufruf überschreiben (make apk ANDROID_HOME=PFAD). Das SDK installiert dieses Makefile nicht (docs/entwicklung/huelle.md);
# fehlende Plattformen und Build-Tools lädt Gradle beim Bau selbst. Die Stufen der Hülle gehören nicht zu make check.
XDG_DATA_HOME ?= $(HOME)/.local/share
ANDROID_HOME ?= $(XDG_DATA_HOME)/android-sdk
GRADLE_USER_HOME ?= $(XDG_DATA_HOME)/gradle
ANDROID_USER_HOME ?= $(XDG_DATA_HOME)/android
export ANDROID_HOME GRADLE_USER_HOME ANDROID_USER_HOME
GRADLEW := android/gradlew -p android

sdk-vorhanden:
	@test -f "$(ANDROID_HOME)/licenses/android-sdk-license" || { \
	  echo "make: Fehler: kein Android-SDK mit angenommener Lizenz in $(ANDROID_HOME)" >&2; \
	  echo "Installier es wie in docs/entwicklung/huelle.md beschrieben." >&2; exit 1; }

# Debug-APK der Hülle; JVM-Tests der Hülle
apk: sdk-vorhanden
	$(GRADLEW) assembleDebug
	@echo "make: APK liegt in android/app/build/outputs/apk/debug/app-debug.apk"

apk-test: sdk-vorhanden
	$(GRADLEW) testDebugUnitTest
